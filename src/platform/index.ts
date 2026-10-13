/* 平台适配层:唯一允许探测 NativeModules / 宿主全局的模块(分层铁律)。
 *
 * 能力探测在模块加载时做一次;所有适配接口以此处导出的实现为准。 */

/* ---------- 探测(仅此处可见) ---------- */

interface NativeStorageModule {
  setStorageItem(key: string, value: string): void;
  getStorageItem(key: string, callback: (value: string) => void): void;
  removeStorageItem?(key: string): void;
}

function detectNativeModules(): Record<string, unknown> | undefined {
  try {
    return (globalThis as unknown as { NativeModules?: Record<string, unknown> }).NativeModules;
  } catch { return undefined; }
}

const NM = detectNativeModules();

/** Web 预览环境判定(仅用于选 Web 回退实现) */
export const isWeb =
  typeof (globalThis as unknown as { location?: unknown }).location !== 'undefined';

export const capabilities = {
  /** 真机 KV 存储 Native Module */
  nativeStorage: !!NM && !!(NM as { Storage?: NativeStorageModule }).Storage,
};

/* ---------- storage:KV 接口 ---------- */

export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

function nativeStorage(): Storage {
  const m = (NM as { Storage: NativeStorageModule }).Storage;
  return {
    get: (key) => new Promise((resolve) => {
      try { m.getStorageItem(key, (v) => resolve(v || null)); }
      catch { resolve(null); }
    }),
    set: (key, value) => {
      try { m.setStorageItem(key, value); } catch { /* 宿主存储失败不致命 */ }
      return Promise.resolve();
    },
    remove: (key) => {
      try { m.removeStorageItem?.(key); } catch { /* 同上 */ }
      return Promise.resolve();
    },
  };
}

function webStorage(): Storage {
  // 内存兜底:实测 srcdoc 沙箱 iframe(lynx web 预览)里 localStorage 写入抛
  // SecurityError 被吞,数据静默丢失——至少会话内要可用。localStorage 仍双写,
  // 正常浏览器环境重启后可恢复。
  const mem = new Map<string, string>();
  const ls = () => (globalThis as unknown as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } }).localStorage;
  return {
    get: async (key) => {
      const m = mem.get(key);
      if (m !== undefined) return m;
      try { return ls()?.getItem(key) ?? null; } catch { return null; }
    },
    set: async (key, value) => {
      mem.set(key, value);
      try { ls()?.setItem(key, value); } catch { /* 沙箱/隐私模式:内存兜底已写 */ }
    },
    remove: async (key) => {
      mem.delete(key);
      try { ls()?.removeItem(key); } catch { /* noop */ }
    },
  };
}

export const storage: Storage = capabilities.nativeStorage ? nativeStorage() : webStorage();

/* ---------- http:脚本流量统一出口 ---------- */

/** 回调式请求(与 lx.request 协议对齐;bridge/sandbox 依赖此签名) */
export type HttpCallback = (
  err: Error | null,
  resp: { statusCode: number; headers: Record<string, string>; body: unknown } | null,
) => void;

export function httpRequest(url: string, opts: Record<string, unknown>, cb: HttpCallback, timeoutMs = 15000): void {
  'background only';
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const fetchOpts: Record<string, unknown> = {
    method: (opts.method as string) || 'GET',
    headers: opts.headers ?? {},
    signal: controller?.signal,
  };
  if (opts.body != null) fetchOpts.body = opts.body as string;

  fetch(url, fetchOpts as Parameters<typeof fetch>[1])
    .then(async (r) => {
      const text = await r.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* 保留纯文本 */ }
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => { headers[k] = v; });
      cb(null, { statusCode: r.status, headers, body });
    })
    .catch((e: unknown) => {
      cb(e instanceof Error ? e : new Error(String(e)), null);
    })
    .finally(() => { if (timer) clearTimeout(timer); });
}

/* ---------- system:安全区等宿主信息(迁自 App.tsx readSafeTop) ---------- */

/** 安全区回退值:真机由宿主 NativeModules.SafeArea 注入;开源版无 getSystemInfoSync,不可依赖 */
const DEFAULT_SAFE_TOP = 47;

export function readSafeTop(): number {
  try {
    const v = (NM as { SafeArea?: { getTop?: () => number } } | undefined)?.SafeArea?.getTop?.();
    return typeof v === 'number' && v > 0 ? v : DEFAULT_SAFE_TOP;
  } catch {
    return DEFAULT_SAFE_TOP;
  }
}
