/* lx 音源脚本协议类型定义。
 *
 * 协议要点(2026-10 对 3 份真实音源脚本实测得出,勿凭想象修改):
 * - 脚本是普通 JS 字符串,求值时从 globalThis.lx 解构取 API
 * - 脚本侧用 `lx.on(lx.EVENT_NAMES.request, handler)` 注册取链处理器
 * - 宿主侧用 `lx.request(url, opts, callback)` 替脚本发 HTTP(回调式,非 Promise)
 * - 初始化完成后脚本 `lx.send(lx.EVENT_NAMES.inited, {status, sources})` 上报能力
 * - 实测 API 面:EVENT_NAMES / request / on / send / version / env /
 *   currentScriptInfo / utils{crypto, buffer, zlib}
 *   (三个脚本均未用到 musicSources 导出——能力声明走 inited 事件)
 * - utils.buffer 同时存在 buffToString 与 bufToString 两个名字(实测野花脚本用后者)
 * - request handler 的 info 结构:{ musicInfo: {songmid...}, type: quality },
 *   返回 Promise<string|url>;source 为 kw/wy/kg/mg/tx
 */

/** lx 脚本取链请求(宿主 → 脚本) */
export interface LxRequestPayload {
  source: string;
  action: 'musicUrl';
  info: { musicInfo: Record<string, unknown>; type: string };
}

/** 音源能力声明(脚本 inited 上报) */
export interface LxSourceInfo {
  type: 'music';
  name: string;
  actions: string[];
  qualitys: string[];
}

/** 脚本注册表条目(持久化到 platform/storage) */
export interface ScriptEntry {
  /** 稳定 id(脚本名+版本哈希) */
  id: string;
  /** 头部注释解析出的元数据 */
  name: string;
  version: string;
  author?: string;
  /** 是否启用 */
  enabled: boolean;
  /** inited 上报的各源能力,运行时填充 */
  sources: Record<string, LxSourceInfo>;
  /** 脚本全文(存 KV,大字符串,只此一处) */
  code: string;
  /** 安装时间(ms) */
  installedAt: number;
}

/** 取链结果 */
export interface UrlResult {
  url: string;
  /** 实际命中的源 */
  source: string;
  /** 来自哪个脚本 */
  scriptId: string;
}

/** 取链错误分类(services/player 据此提示用户) */
export type ResolveErrorCode =
  | 'no-enabled-script'   // 没有可用脚本
  | 'source-not-found'    // 该源没有脚本支持
  | 'all-failed'          // 所有脚本都失败
  | 'timeout';            // 全部超时

export class ResolveError extends Error {
  code: ResolveErrorCode;
  constructor(code: ResolveErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
