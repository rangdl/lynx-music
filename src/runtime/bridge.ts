/* 桥接层:对 services/source 暴露纯 Promise API,内部管理脚本实例池。
 *
 * 职责:
 * - 脚本实例的加载/缓存/按需重建(注册表由 services 层持久化,这里只管活实例)
 * - 单脚本取链带超时;调用方(services)负责多脚本降级编排
 * - 错误包装:脚本内部错误统一为 ScriptError,不让脚本异常泄漏到上层
 */

import { loadScript, type ScriptInstance } from './sandbox.js';
import type { RequestFn } from './api/lxApi.js';
import type { LxRequestPayload, LxSourceInfo } from './types.js';

export interface BridgeDeps {
  /** 网络出口(platform/http 提供) */
  request: RequestFn;
  /** 可选:宿主 crypto 实现 */
  crypto?: { md5?: (s: string, t?: string) => string; sha1?: (s: string, t?: string) => string; sha256?: (s: string, t?: string) => string };
}

export class ScriptError extends Error {
  scriptName: string;
  constructor(scriptName: string, message: string) {
    super(`[${scriptName}] ${message}`);
    this.scriptName = scriptName;
  }
}

interface LoadedEntry {
  instance: ScriptInstance;
  name: string;
}

export class SourceBridge {
  private deps: BridgeDeps;
  /** scriptId → 活实例 */
  private loaded = new Map<string, LoadedEntry>();

  constructor(deps: BridgeDeps) {
    this.deps = deps;
  }

  /** 加载(或复用)脚本并等 inited。失败抛 ScriptError。 */
  async load(scriptId: string, name: string, version: string, code: string): Promise<Record<string, LxSourceInfo>> {
    const existing = this.loaded.get(scriptId);
    if (existing) return existing.instance.sources;

    const instance = await loadScript({
      scriptName: name, scriptVersion: version, code,
      request: this.deps.request, crypto: this.deps.crypto,
    });
    this.loaded.set(scriptId, { instance, name });
    return instance.sources;
  }

  /** 取链。脚本未加载/失败/超时都抛 ScriptError,由上层决定换源。 */
  async musicUrl(scriptId: string, payload: LxRequestPayload, timeoutMs = 10000): Promise<string> {
    const entry = this.loaded.get(scriptId);
    if (!entry) throw new ScriptError(scriptId, '脚本未加载');
    try {
      const url = await entry.instance.musicUrl(payload, timeoutMs);
      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
        throw new Error(`脚本返回了非法 url: ${JSON.stringify(url)?.slice(0, 80)}`);
      }
      return url;
    } catch (e) {
      throw new ScriptError(entry.name, e instanceof Error ? e.message : String(e));
    }
  }

  /** 卸载脚本(注册表删除/禁用时调用) */
  unload(scriptId: string) {
    const entry = this.loaded.get(scriptId);
    if (entry) {
      entry.instance.dispose();
      this.loaded.delete(scriptId);
    }
  }

  unloadAll() {
    for (const id of [...this.loaded.keys()]) this.unload(id);
  }
}
