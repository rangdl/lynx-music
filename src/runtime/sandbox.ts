/* 沙箱:求值不可信的 lx 脚本并隔离运行。
 *
 * 隔离策略(实测三份脚本后定的最小面):
 * - new Function('globalThis', code) 求值,globalThis 参数指向受控代理
 * - 代理只暴露 lx / 基础内置对象;任何其他全局(window/document/NativeModules)取不到
 * - 脚本崩溃只销毁该实例,不影响宿主;初始化/取链均带超时
 *
 * 已知限制(如实记录):new Function 无法阻止脚本在同一次同步执行里死循环,
 * 超时保护只覆盖异步阶段;同步死循环会卡后台线程。缓解:安装时健康检查 +
 * 用户可卸载。若未来出现恶意脚本问题,可换 Web 端 Worker 化执行。 */

import { createLxApi, type RequestFn } from './api/lxApi.js';
import type { LxRequestPayload, LxSourceInfo } from './types.js';

export interface SandboxOptions {
  scriptName: string;
  scriptVersion: string;
  code: string;
  /** 网络出口(必须来自 platform/http,勿直接传 fetch) */
  request: RequestFn;
  /** 初始化等待超时(ms),默认 8000 */
  initTimeoutMs?: number;
  /** 脚本元数据:md5 等宿主 crypto 实现(可选) */
  crypto?: { md5?: (s: string, t?: string) => string; sha1?: (s: string, t?: string) => string; sha256?: (s: string, t?: string) => string };
}

export interface ScriptInstance {
  /** inited 上报的源能力 */
  sources: Record<string, LxSourceInfo>;
  /** 触发一次取链,返回脚本给的 url */
  musicUrl(payload: LxRequestPayload, timeoutMs?: number): Promise<string>;
  /** 丢弃实例( merely drops refs; JS 无法真正终止求值中的代码 ) */
  dispose(): void;
}

export function loadScript(opts: SandboxOptions): Promise<ScriptInstance> {
  const { scriptName, scriptVersion, code, request } = opts;

  return new Promise((resolve, reject) => {
    let settled = false;
    let sources: Record<string, LxSourceInfo> = {};

    const lx = createLxApi({
      request,
      version: '2.0.0',
      scriptInfo: { name: scriptName, version: scriptVersion, author: '', rawScript: code },
      onInited: (s, status) => {
        sources = s;
        clearTimeout(timer);
        if (!status) return reject(new Error(`${scriptName}: 脚本上报初始化失败`));
        if (!settled) { settled = true; resolve(instance); }
      },
    });
    if (opts.crypto) {
      // 宿主注入了真实哈希实现则替换兜底
      Object.assign(lx.utils.crypto, {
        md5: opts.crypto.md5, sha1: opts.crypto.sha1, sha256: opts.crypto.sha256,
      });
    }

    const instance: ScriptInstance = {
      get sources() { return sources; },
      musicUrl: (payload, timeoutMs = 10000) => {
        const handler = (lx as unknown as { _requestHandler?: (p: LxRequestPayload) => Promise<string> })._requestHandler;
        if (!handler) return Promise.reject(new Error(`${scriptName}: 脚本未注册 request 处理器`));
        return Promise.race([
          Promise.resolve(handler(payload)),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${scriptName}: 取链超时`)), timeoutMs)),
        ]);
      },
      dispose: () => { sources = {}; },
    };

    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error(`${scriptName}: 初始化超时(脚本未上报 inited)`)); }
    }, opts.initTimeoutMs ?? 8000);

    // 受控 globalThis:白名单透出
    const sandboxGlobal: Record<string, unknown> = {
      lx,
      console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} }, // 脚本日志静默
      setTimeout, clearTimeout, setInterval, clearInterval,
      Promise, Error, TypeError, RangeError, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp,
      parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
      Uint8Array, ArrayBuffer, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    };
    const globalProxy = new Proxy(sandboxGlobal, {
      get(t, k) {
        if (k === 'globalThis') return globalProxy;
        return t[k as string];
      },
      has() { return true; }, // 欺骗 with/typeof 检测,让脚本以为全局都存在,取不到就是 undefined
      set(t, k, v) { t[k as string] = v; return true; },
    });

    try {
      // with + has-trap 拦截:typeof window/document 走白名单而非真实全局。
      // Proxy 的 has() 返回 true 使 with 块内所有自由变量都从代理取,
      // 白名单外的键 get 返回 undefined —— 这是隔离的关键(实测 jsdom 下
      // 直接 new Function 时 typeof window 仍会命中宿主真实全局)。
      // 注意:with 与 "use strict" 互斥,工厂函数本体不能开严格模式;
      // 隔离不依赖 strict,而依赖 with 的作用域劫持。
      const factory = new Function('globalThis', `
        with (globalThis) {
          ${code}
        }
      `);
      factory.call(globalProxy, globalProxy);
      // 不立即 settle:等脚本 send(inited) 或 timer 超时
    } catch (e) {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(e instanceof Error ? e : new Error(String(e))); }
    }
  });
}
