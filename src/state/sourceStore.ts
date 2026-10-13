/* 音源脚本 store:注册表 UI 状态 + 对 sourceService 的 dispatch。 */

import { create } from 'zustand';
import { sourceService } from '../services/source/sourceService.js';
import type { ScriptEntry } from '../runtime/types.js';

interface SourceState {
  scripts: ScriptEntry[];
  /** 导入中(健康检查进行时) */
  installing: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  installFromCode: (code: string) => Promise<boolean>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  scripts: [],
  installing: false,
  error: null,

  refresh: async () => {
    'background only';
    set({ scripts: await sourceService.listScripts() });
  },

  installFromCode: async (code) => {
    'background only';
    if (get().installing) return false;
    set({ installing: true, error: null });
    try {
      await sourceService.install(code);
      set({ installing: false, scripts: await sourceService.listScripts() });
      return true;
    } catch (e) {
      set({ installing: false, error: String((e as Error)?.message ?? e) });
      return false;
    }
  },

  toggle: async (id) => {
    'background only';
    const s = get().scripts.find((x) => x.id === id);
    if (!s) return;
    await sourceService.setEnabled(id, !s.enabled);
    set({ scripts: await sourceService.listScripts() });
  },

  remove: async (id) => {
    'background only';
    await sourceService.remove(id);
    set({ scripts: await sourceService.listScripts() });
  },

  clearError: () => { 'background only'; set({ error: null }); },
}));
