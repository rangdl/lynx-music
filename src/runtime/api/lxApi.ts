/* 注入给 lx 脚本的 lx API 对象(事件总线 + utils)。
 *
 * 唯一职责:构造沙箱可见的 globalThis.lx。网络请求不走这里——
 * 脚本拿到的 request 函数由 sandbox 注入,统一委托 platform/http。 */

import type { LxRequestPayload, LxSourceInfo } from '../types.js';

export const EVENT_NAMES = {
  request: 'request',
  inited: 'inited',
  updateAlert: 'updateAlert',
} as const;

export type RequestFn = (
  url: string,
  opts: Record<string, unknown>,
  cb: (err: Error | null, resp: { statusCode: number; headers: Record<string, string>; body: unknown } | null) => void,
) => void;

export interface LxApiHost {
  /** 宿主实现的真实网络请求(来自 platform/http) */
  request: RequestFn;
  /** inited 上报回调 */
  onInited: (sources: Record<string, LxSourceInfo>, status: boolean) => void;
  /** 版本号:宿主模拟的 lx 版本 */
  version: string;
  scriptInfo: { name: string; version: string; author: string; rawScript: string };
}

/**
 * 构造一个脚本专属的 lx 对象。utils 的实现是纯 JS(不依赖 node:crypto),
 * 目的是让同一份代码在 Lynx 后台线程跑得通——md5/sha 系用平台注入的
 * crypto 实现者(haric),宿主没给则提供明确报错的兜底。
 */
export function createLxApi(host: LxApiHost) {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};

  const lx = {
    EVENT_NAMES,
    version: host.version,
    env: 'mobile',
    currentScriptInfo: host.scriptInfo,

    on(event: string, fn: (...args: unknown[]) => unknown) {
      handlers[event] = fn;
    },
    send(event: string, data: unknown) {
      if (event === EVENT_NAMES.inited && data && typeof data === 'object') {
        const d = data as { status?: boolean; sources?: Record<string, LxSourceInfo> };
        host.onInited(d.sources ?? {}, d.status !== false);
      }
      // updateAlert 等事件忽略(本项目不弹更新提示)
    },
    request: host.request,

    /** 脚本内部触发请求事件(罕见,聚合类脚本用不到;留作协议完整性) */
    _emit(event: string, payload: unknown) {
      return handlers[event]?.(payload);
    },
    get _requestHandler() {
      return handlers[EVENT_NAMES.request];
    },

    /* ---- utils:实测野花用到 crypto.md5、buffer.from、buffer.bufToString/buffToString ---- */
    utils: {
      crypto: createCryptoUtils(),
      buffer: createBufferUtils(),
      zlib: createZlibStub(),
    },
  };
  return lx;
}

/* crypto:真实哈希由宿主通过 injectCrypto 提供(Lynx 后台线程无 node:crypto);
 * Web 预览下宿主可给 SubtleCrypto 包装。未注入时调用即抛错,让脚本失败可观测。 */
export function createCryptoUtils(
  inject?: {
    md5?: (s: string, type?: string) => string;
    sha1?: (s: string, type?: string) => string;
    sha256?: (s: string, type?: string) => string;
  },
) {
  const missing = (name: string) => () => {
    throw new Error(`lx.utils.crypto.${name} 未由宿主实现`);
  };
  return {
    md5: inject?.md5 ?? missing('md5'),
    sha1: inject?.sha1 ?? missing('sha1'),
    sha256: inject?.sha256 ?? missing('sha256'),
    aesEncrypt: () => { throw new Error('lx.utils.crypto.aesEncrypt 未由宿主实现'); },
    rsaEncrypt: () => { throw new Error('lx.utils.crypto.rsaEncrypt 未由宿主实现'); },
    randomBytes: (n: number, type = 'hex') => randomHex(n, type),
  };
}

function randomHex(n: number, _type: string) {
  // 简易 PRNG 兜底;安全性无关(脚本签名用),宿主可后续注入更强实现
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

/* buffer:实测(野花脚本)真实语义是 bufToString(buff, type) 的 type 为【输出】编码,
 * 即把 buff 内容编码为 hex/base64 字符串输出——与直觉的「解码」相反。
 * 三参形式 buffToString(buff, inType, outType) 才是 in→utf8→out 转码。
 * Lynx 跨线程传 ArrayBuffer 会变成 {type:'Buffer',data:[..]} 形态,统一归一化。 */
export function createBufferUtils() {
  const toStr = (buff: unknown): string => {
    if (typeof buff === 'string') return buff;
    const u8 = toU8(buff);
    let s = '';
    for (const b of u8) s += String.fromCharCode(b);
    return s;
  };
  const toU8 = (buff: unknown): Uint8Array => {
    if (buff instanceof Uint8Array) return buff;
    if (buff && typeof buff === 'object' && Array.isArray((buff as { data?: number[] }).data)) {
      return new Uint8Array((buff as { data: number[] }).data);
    }
    if (Array.isArray(buff)) return new Uint8Array(buff as number[]);
    throw new Error('lx.utils.buffer: 无法识别的 buff 类型');
  };
  const encode = (s: string, type: string): string => {
    if (type === 'hex') {
      return Array.from(s).map((c) => (c.charCodeAt(0) & 0xff).toString(16).padStart(2, '0')).join('');
    }
    if (type === 'base64') return b64Encode(s);
    return s;
  };
  const decode = (s: string, type: string): string => {
    if (type === 'hex') {
      let out = '';
      for (let i = 0; i + 1 < s.length; i += 2) {
        const v = parseInt(s.substr(i, 2), 16);
        if (!Number.isNaN(v)) out += String.fromCharCode(v);
      }
      return out;
    }
    if (type === 'base64') {
      const raw = b64Decode(s);
      let out = '';
      for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) & 0xff);
      return out;
    }
    return s;
  };
  const toString = (buff: unknown, inType?: string, outType?: string): string => {
    const s = toStr(buff);
    // 二参调用 (buff, type):type 是输出编码(实测野花用法)
    if (inType !== undefined && outType === undefined) return encode(s, inType);
    // 三参调用:inType 解码 → outType 编码
    let text = inType ? decode(s, inType) : s;
    if (outType) text = encode(text, outType);
    return text;
  };
  return {
    from: (s: string | number[]) => (typeof s === 'string' ? strToU8JSON(s) : new Uint8Array(s)),
    buffToString: toString,
    bufToString: toString, // 实测野花脚本访问的是这个名字
  };
}

function strToU8JSON(s: string) {
  const arr: number[] = [];
  for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i) & 0xff);
  return arr; // lx 语义:from 返回可回传给 toString 的类 buffer 结构
}

function b64Encode(s: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const b0 = s.charCodeAt(i) & 0xff, b1 = s.charCodeAt(i + 1) & 0xff, b2 = s.charCodeAt(i + 2) & 0xff;
    out += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += Number.isNaN(b1) ? '=' : chars[((b1 & 15) << 2) | (b2 >> 6)];
    out += Number.isNaN(b2) ? '=' : chars[b2 & 63];
  }
  return out;
}

function b64Decode(s: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  s = s.replace(/=+$/, '');
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const n = (chars.indexOf(s[i]) << 18) | (chars.indexOf(s[i + 1]) << 12) |
      ((chars.indexOf(s[i + 2]) & 0xff) << 6) | (chars.indexOf(s[i + 3]) & 0xff);
    out += String.fromCharCode((n >> 16) & 0xff);
    if (s[i + 2]) out += String.fromCharCode((n >> 8) & 0xff);
    if (s[i + 3]) out += String.fromCharCode(n & 0xff);
  }
  return out;
}

/* zlib:三个测试脚本都没用到,先给可观测的报错桩 */
function createZlibStub() {
  const missing = (name: string) => () => {
    throw new Error(`lx.utils.zlib.${name} 未由宿主实现`);
  };
  return {
    deflate: missing('deflate'), deflateRaw: missing('deflateRaw'), gzip: missing('gzip'),
    inflate: missing('inflate'), inflateRaw: missing('inflateRaw'), ungzip: missing('ungzip'),
  };
}
