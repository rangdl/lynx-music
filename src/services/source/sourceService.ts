/* 音源编排服务:注册表持久化 + 多脚本降级取链。
 *
 * - 注册表(脚本列表/启停/顺序)持久化到 platform/storage,键 lx_sources_v1
 * - 取链策略:按注册表顺序对支持该 source 的启用脚本逐个尝试,
 *   单脚本失败/超时即换下一个;全部失败抛 ResolveError(all-failed)
 * - 结果负缓存 30s:刚失败的 (songmid, source, quality) 短窗内不再重试
 */

import { SourceBridge, ScriptError } from '../../runtime/bridge.js';
import { storage, httpRequest } from '../../platform/index.js';
import type { LxRequestPayload, LxSourceInfo, ScriptEntry, ResolveErrorCode, UrlResult } from '../../runtime/types.js';
import { ResolveError } from '../../runtime/types.js';

const REGISTRY_KEY = 'lx_sources_v1';

export interface ResolveQuery {
  songmid: string;
  source: string;
  quality: string;
}

/** 头部注释元数据解析:@name/@version/@author(缺省给占位值) */
export function parseScriptMeta(code: string): { name: string; version: string; author: string } {
  const head = code.slice(0, 2000);
  const grab = (key: string) => head.match(new RegExp(`@${key}\\s+(.+)`))?.[1]?.trim();
  return {
    name: grab('name') || '未命名脚本',
    version: grab('version') || '0',
    author: grab('author') || '',
  };
}

/** 简单内容 id:名字+版本+长度(避免引入哈希依赖;区分度足够注册表用) */
function makeId(meta: { name: string; version: string }, code: string): string {
  return `${meta.name}@${meta.version}`.replace(/\s+/g, '_') + '#' + code.length;
}

export class SourceService {
  /** 宿主 crypto 注入口(services 层组装时传入;Web 可传 SubtleCrypto 包装) */
  private bridge = new SourceBridge({
    request: (url, opts, cb) => httpRequest(url, opts, cb),
  });

  private registry: ScriptEntry[] | null = null;
  /** 负缓存:key → 到期时间戳(ms) */
  private failCache = new Map<string, number>();
  private static FAIL_TTL = 30_000;

  /* ---------- 注册表 ---------- */

  async listScripts(): Promise<ScriptEntry[]> {
    if (!this.registry) {
      const raw = await storage.get(REGISTRY_KEY);
      try { this.registry = raw ? JSON.parse(raw) as ScriptEntry[] : []; }
      catch { this.registry = []; }
    }
    return this.registry;
  }

  private async persist(): Promise<void> {
    await storage.set(REGISTRY_KEY, JSON.stringify(this.registry ?? []));
  }

  /** 安装脚本:解析元数据 → 加载健康检查 → 入注册表。
   *  健康检查标准:能求值 + 上报 inited(不实际取链,服务器状态随时会变)。 */
  async install(code: string): Promise<ScriptEntry> {
    'background only';
    const meta = parseScriptMeta(code);
    const id = makeId(meta, code);
    const existing = (await this.listScripts()).find((s) => s.id === id);
    if (existing) throw new Error(`脚本已安装:${meta.name} v${meta.version}`);

    // 健康检查:加载并等 inited(不健康会抛错)
    const sources = await this.bridge.load(id, meta.name, meta.version, code);
    if (!Object.keys(sources).length) throw new Error(`${meta.name}: 未上报任何音源能力`);

    const entry: ScriptEntry = {
      id, name: meta.name, version: meta.version, author: meta.author,
      enabled: true, sources, code, installedAt: Date.now(),
    };
    this.registry!.push(entry);
    await this.persist();
    return entry;
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const e = (await this.listScripts()).find((s) => s.id === id);
    if (!e) throw new Error('脚本不存在');
    e.enabled = enabled;
    if (!enabled) this.bridge.unload(id);
    await this.persist();
  }

  async remove(id: string): Promise<void> {
    this.registry = (await this.listScripts()).filter((s) => s.id !== id);
    this.bridge.unload(id);
    await this.persist();
  }

  /** 供设置页展示各脚本当前能力(inited 后的真实数据) */
  async refreshSources(id: string): Promise<Record<string, LxSourceInfo>> {
    const e = (await this.listScripts()).find((s) => s.id === id);
    if (!e) throw new Error('脚本不存在');
    const sources = await this.bridge.load(id, e.name, e.version, e.code);
    e.sources = sources;
    await this.persist();
    return sources;
  }

  /* ---------- 取链 ---------- */

  /** 按注册表顺序尝试所有「已启用且支持该 source」的脚本 */
  async resolve(query: ResolveQuery): Promise<UrlResult> {
    'background only';
    const cacheKey = `${query.source}|${query.songmid}|${query.quality}`;
    const until = this.failCache.get(cacheKey);
    if (until && until > Date.now()) {
      throw new ResolveError('all-failed', '该歌曲刚取链失败,冷却中');
    }

    const scripts = (await this.listScripts()).filter((s) => s.enabled && s.sources[query.source]);
    if (!(await this.listScripts()).length) throw new ResolveError('no-enabled-script', '未安装任何音源脚本');
    if (!scripts.length) throw new ResolveError('source-not-found', `没有脚本支持 ${query.source} 源`);

    const payload: LxRequestPayload = {
      source: query.source,
      action: 'musicUrl',
      info: { musicInfo: { songmid: query.songmid }, type: query.quality },
    };

    const errors: string[] = [];
    for (const script of scripts) {
      try {
        await this.bridge.load(script.id, script.name, script.version, script.code); // 幂等,已加载则直接返回
        const url = await this.bridge.musicUrl(script.id, payload);
        return { url, source: query.source, scriptId: script.id };
      } catch (e) {
        errors.push(e instanceof ScriptError ? e.message : String(e));
      }
    }
    this.failCache.set(cacheKey, Date.now() + SourceService.FAIL_TTL);
    throw new ResolveError('all-failed', `所有脚本取链失败:${errors.join('; ').slice(0, 300)}`);
  }
}

/** 单例:services 层约定(架构文档 §4),重资源放模块级单例 */
export const sourceService = new SourceService();

export type { ResolveErrorCode };
