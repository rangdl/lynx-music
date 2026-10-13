/* 播放器 store:可序列化状态 + dispatch action。
 * 音频实例/取链服务等重资源不进 store(分层铁律),经模块单例引用。 */

import { create } from 'zustand';
import { audio } from '../platform/audio.js';
import { sourceService } from '../services/source/sourceService.js';
import { PLAYLIST } from '../data/settings.js';
import type { Song } from '../data/settings.js';
import { ResolveError } from '../runtime/types.js';

export type SourceName = 'kw' | 'wy' | 'kg' | 'mg' | 'tx';

interface PlayerState {
  queue: Song[];
  currentId: number | null;
  playing: boolean;
  position: number;
  duration: number;
  /** 取链中(loading 态) */
  resolving: boolean;
  /** 用户可读的错误提示(一次性消费) */
  error: string | null;
  source: SourceName;
  quality: string;

  play: (id: number) => void;
  togglePlay: () => void;
  next: () => void;
  seek: (sec: number) => void;
  setSource: (s: SourceName) => void;
  clearError: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: PLAYLIST,
  currentId: null,
  playing: false,
  position: 0,
  duration: 0,
  resolving: false,
  error: null,
  source: 'kw',
  quality: '128k',

  play: (id) => {
    'background only';
    const { source, quality } = get();
    set({ currentId: id, resolving: true, error: null, position: 0 });
    const song = PLAYLIST.find((s) => s.id === id);
    if (!song) return;

    // lx 脚本按歌名/歌手查不到 songmid;这里用歌名做演示级取链参数。
    // 真实音乐库接入后,songmid 来自库内元数据(迁移顺序第 6 步)。
    sourceService.resolve({ songmid: song.title, source, quality })
      .then(({ url }) => {
        if (get().currentId !== id) return; // 用户已切歌,丢弃过期结果
        audio.setEvents({
          onState: (s) => set({ playing: s.playing, position: s.position, duration: s.duration }),
          onEnded: () => get().next(),
          onError: (msg) => set({ error: msg, playing: false }),
        });
        audio.play(url);
        set({ resolving: false, playing: true });
      })
      .catch((e: unknown) => {
        const msg = e instanceof ResolveError
          ? (e.code === 'no-enabled-script' ? '请先在设置中导入音源脚本' : e.message)
          : String((e as Error)?.message ?? e);
        set({ resolving: false, playing: false, error: msg });
      });
  },

  togglePlay: () => {
    'background only';
    const { playing, currentId, play } = get();
    if (currentId === null) { if (PLAYLIST.length) play(PLAYLIST[0].id); return; }
    if (playing) { audio.pause(); set({ playing: false }); }
    else { audio.play(''); set({ playing: true }); } // 空 url = resume
  },

  next: () => {
    'background only';
    const { queue, currentId, play } = get();
    if (!queue.length) return;
    const idx = queue.findIndex((s) => s.id === currentId);
    play(queue[(idx + 1) % queue.length].id);
  },

  seek: (sec) => {
    'background only';
    audio.seek(sec);
    set({ position: sec });
  },

  setSource: (s) => {
    'background only';
    set({ source: s });
    const { currentId, playing, play } = get();
    if (currentId !== null && playing) play(currentId); // 换源重取链
  },

  clearError: () => { 'background only'; set({ error: null }); },
}));
