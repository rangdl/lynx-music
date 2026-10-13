/* 音频播放适配:真机 NativeModules.Audio / Web <audio> 回退。
 * platform 层唯一允许碰 audio 元素的地方(Web 分支)。 */

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

/* ---------- Web 回退:<audio>(仅 Web 环境合法) ---------- */

function webAudio(): AudioAdapter {
  // 惰性创建:模块加载时 document 可能尚未就绪(实测 web 预览首帧前即崩),
  // 首次 play() 才建 <audio>。真机上无 document,永不触达此分支。
  let el: HTMLAudioElement | null = null;
  let events: AudioEvents = {};
  let lastTick = 0;

  const ensure = (): HTMLAudioElement | null => {
    if (el) return el;
    // 实测:web 预览的取链/播放回调可能跑在无 document 的 worker 上下文,
    // 此处直接挂掉;让调用方收到 onError 而非 JSRuntime 崩溃。
    const doc = (globalThis as unknown as { document?: { createElement(t: string): HTMLAudioElement } }).document;
    if (!doc?.createElement) return null;
    el = doc.createElement('audio');
    el.preload = 'auto';
    el.addEventListener('play', () => events.onState?.({ playing: true, position: el!.currentTime, duration: el!.duration || 0 }));
    el.addEventListener('pause', () => events.onState?.({ playing: false, position: el!.currentTime, duration: el!.duration || 0 }));
    el.addEventListener('ended', () => events.onEnded?.());
    el.addEventListener('error', () => events.onError?.('音频加载失败'));
    el.addEventListener('timeupdate', () => {
      // 500ms 节流:进度回写 store 不需要 60fps
      const now = Date.now();
      if (now - lastTick > 500) {
        lastTick = now;
        events.onState?.({ playing: !el!.paused, position: el!.currentTime, duration: el!.duration || 0 });
      }
    });
    return el;
  };

  return {
    play: (url) => {
      'background only';
      const a = ensure();
      if (!a) { events.onError?.('当前环境不支持 Web 音频播放'); return; }
      // resume 语义:url 为空且已有 src → 继续;否则换曲
      if (url && a.src !== url) a.src = url;
      if (!a.src) return;
      void a.play().catch(() => events.onError?.('播放被浏览器拦截'));
    },
    pause: () => { 'background only'; el?.pause(); },
    seek: (sec) => { 'background only'; if (el) el.currentTime = sec; },
    setEvents: (e) => { events = e; },
  };
}

/* ---------- 真机:NativeModules.Audio(未来宿主实现) ---------- */

interface NativeAudioModule {
  play(url: string): void;
  pause(): void;
  seek(sec: number): void;
  /** 事件回调注册(宿主约定) */
  onEvent(cb: (ev: { type: string; position?: number; duration?: number; msg?: string }) => void): void;
}

function nativeAudio(): AudioAdapter {
  const m = (globalThis as unknown as { NativeModules: { Audio: NativeAudioModule } }).NativeModules.Audio;
  let events: AudioEvents = {};
  m.onEvent((ev) => {
    if (ev.type === 'state') events.onState?.({ playing: ev.position !== undefined && ev.position > -1, position: ev.position ?? 0, duration: ev.duration ?? 0 });
    else if (ev.type === 'ended') events.onEnded?.();
    else if (ev.type === 'error') events.onError?.(ev.msg ?? '播放失败');
  });
  return {
    play: (url) => { 'background only'; m.play(url); },
    pause: () => { 'background only'; m.pause(); },
    seek: (sec) => { 'background only'; m.seek(sec); },
    setEvents: (e) => { events = e; },
  };
}

const NM = (() => {
  try { return (globalThis as unknown as { NativeModules?: { Audio?: NativeAudioModule } }).NativeModules?.Audio; }
  catch { return undefined; }
})();

export const audio: AudioAdapter = NM ? nativeAudio() : webAudio();
