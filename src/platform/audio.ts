/* 音频播放适配:真机 NativeModules.LynxAudio / Web 主线程宿主(同协议)。
 *
 * 套用 songloft-player-lynx 方案:Web 下 audio-host.js(主线程,有 document)
 * 把 HTMLAudioElement 注册成 NativeModules.LynxAudio,本文件是两平台共用的
 * worker 侧绑定 —— 方法调用走 native module,事件回传走 GlobalEventEmitter
 * (lynxView.sendGlobalEvent(name, [payload]),payload 是数组首元素)。
 *
 * 事件名必须与 web/audio-host.js 的 AUDIO_EVENT 逐字节一致(单一最易错接缝,
 * 见 songloft native-audio.ts 注释)。真机宿主未来实现 LynxAudio 原生模块时
 * 沿用同名事件即可,无需改本文件。 */

export interface AudioState {
  playing: boolean;
  /** 当前秒 */
  position: number;
  duration: number;
}

export interface AudioEvents {
  onState?: (s: AudioState) => void;
  onEnded?: () => void;
  onError?: (msg: string) => void;
}

export interface AudioAdapter {
  play(url: string): void;
  pause(): void;
  seek(sec: number): void;
  setEvents(e: AudioEvents): void;
}

/* 事件名(web/audio-host.js 同名常量的镜像) */
const EVT = {
  sourceReady: 'LynxAudio.sourceReady',
  stateChanged: 'LynxAudio.stateChanged',
  progress: 'LynxAudio.progress',
  error: 'LynxAudio.error',
} as const;

interface LynxAudioModule {
  load(url: string): void;
  play(): void;
  pause(): void;
  stop(): void;
  seek(ms: number): void;
  setVolume?(v: number): void;
  setSpeed?(rate: number): void;
  dispose?(): void;
}

interface Emitter {
  addListener(name: string, cb: (...args: unknown[]) => void): void;
  removeListener(name: string, cb: (...args: unknown[]) => void): void;
}

function readNativeModules(): Record<string, unknown> | undefined {
  // NativeModules 是 wrapper 注入的【裸全局】(web-core 调 bundle init 时把 app 实例的
  // nativeModuleProxy 作为函数参数传入,见 web-core-worker-chunk 的 init 参数列表)。
  // 裸标识符未声明时读取会 ReferenceError,必须 typeof guard;globalThis 兜底供测试注入。
  try {
    if (typeof NativeModules !== 'undefined') return NativeModules as Record<string, unknown>;
  } catch { /* 未声明,落 globalThis */ }
  return (globalThis as unknown as { NativeModules?: Record<string, unknown> }).NativeModules;
}

function readEmitter(): Emitter | null {
  try {
    const l = (globalThis as unknown as { lynx?: { getJSModule?(n: string): Emitter | undefined } }).lynx;
    return l?.getJSModule?.('GlobalEventEmitter') ?? null;
  } catch { return null; }
}

const REQUIRED = ['load', 'play', 'pause', 'stop', 'seek'] as const;
function isLynxAudioAvailable(nm: Record<string, unknown> | undefined): boolean {
  const m = nm?.LynxAudio as Record<string, unknown> | undefined;
  if (!m) return false;
  return REQUIRED.every((n) => typeof m[n] === 'function');
}

/* ---------- LynxAudio 绑定(真机与 Web 共用) ---------- */

function lynxAudio(): AudioAdapter {
  const m = readNativeModules()!.LynxAudio as LynxAudioModule;
  const emitter = readEmitter();
  let events: AudioEvents = {};
  let lastUrl = '';

  const stateHandler = (...args: unknown[]): void => {
    const d = (args[0] ?? {}) as { state?: string };
    switch (d.state) {
      case 'playing': events.onState?.({ playing: true, position: lastPos, duration: lastDur }); break;
      case 'paused':
      case 'ready': events.onState?.({ playing: false, position: lastPos, duration: lastDur }); break;
      case 'completed': events.onEnded?.(); break;
      case 'error': events.onError?.('音频加载失败'); break;
      default: break;
    }
  };
  const progressHandler = (...args: unknown[]): void => {
    const d = (args[0] ?? {}) as { positionMs?: number; durationMs?: number };
    lastPos = (d.positionMs ?? 0) / 1000;
    lastDur = (d.durationMs ?? 0) / 1000;
    events.onState?.({ playing: lastPlaying, position: lastPos, duration: lastDur });
  };
  const errorHandler = (...args: unknown[]): void => {
    const d = (args[0] ?? {}) as { code?: string; message?: string };
    events.onError?.(d.message ?? '播放失败');
  };
  if (emitter) {
    emitter.addListener(EVT.stateChanged, stateHandler);
    emitter.addListener(EVT.progress, progressHandler);
    emitter.addListener(EVT.error, errorHandler);
  }

  let lastPos = 0;
  let lastDur = 0;
  let lastPlaying = false;

  return {
    play: (url) => {
      'background only';
      lastPlaying = true;
      // resume 语义:url 为空且已有 src → 继续;否则换曲
      if (url && url !== lastUrl) {
        lastUrl = url;
        m.load(url);
        m.play();
      } else {
        m.play();
      }
      // 乐观置态,实际由 stateChanged 回传纠正
      events.onState?.({ playing: true, position: lastPos, duration: lastDur });
    },
    pause: () => {
      'background only';
      lastPlaying = false;
      m.pause();
    },
    seek: (sec) => { 'background only'; m.seek(Math.round(sec * 1000)); },
    setEvents: (e) => { events = e; },
  };
}

/* ---------- 兜底:无 LynxAudio 时报错而非崩溃 ---------- */

function stubAudio(): AudioAdapter {
  let events: AudioEvents = {};
  return {
    play: () => { 'background only'; events.onError?.('当前环境没有可用的音频模块'); },
    pause: () => { 'background only'; },
    seek: () => { 'background only'; },
    setEvents: (e) => { events = e; },
  };
}

// 实测(2026-10-17):模块加载时 globalThis.NativeModules 可能尚未被 lynx-core 赋值
  // (worker 里 ReactLynx bundle 先于 lynx-core 初始化执行),加载时探测永远失败。
  // 改为惰性:首次 play/pause/seek 才解析;解析不到再落 stub。
let audioImpl: AudioAdapter | null = null;
export const audio: AudioAdapter = {
  play: (url) => { 'background only'; resolve().play(url); },
  pause: () => { 'background only'; resolve().pause(); },
  seek: (sec) => { 'background only'; resolve().seek(sec); },
  setEvents: (e) => { resolve().setEvents(e); },
};
function resolve(): AudioAdapter {
  if (!audioImpl) {
    audioImpl = isLynxAudioAvailable(readNativeModules()) ? lynxAudio() : stubAudio();
  }
  return audioImpl;
}
