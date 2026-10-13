/* 音源脚本 store:注册表 UI 状态 + 对 sourceService 的 dispatch。 */

import { create } from 'zustand';
import { sourceService } from '../services/source/sourceService.js';
import type { ScriptEntry } from '../runtime/types.js';

interface SourceState {
  scripts: ScriptEntry[];
  /** 导入中(健康检查/下载进行时) */
  installing: boolean;
  error: string | null;
  /** 最近一次 URL/压缩包导入的结果提示(成功部分) */
  lastResult: string | null;

  refresh: () => Promise<void>;
  installFromCode: (code: string) => Promise<boolean>;
  installFromUrl: (url: string) => Promise<boolean>;
  toggle: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  scripts: [],
  installing: false,
  error: null,
  lastResult: null,

  refresh: async () => {
    'background only';
    set({ scripts: await sourceService.listScripts() });
  },

  installFromCode: async (code) => {
    'background only';
    if (get().installing) return false;
    set({ installing: true, error: null, lastResult: null });
    try {
      await sourceService.install(code);
      set({ installing: false, scripts: await sourceService.listScripts() });
      return true;
    } catch (e) {
      set({ installing: false, error: String((e as Error)?.message ?? e) });
      return false;
    }
  },

  installFromUrl: async (url) => {
    'background only';
    if (get().installing) return false;
    set({ installing: true, error: null, lastResult: null });
    try {
      const { installed, errors } = await sourceService.installFromUrl(url);
      const names = installed.map((s) => s.name).join('、');
      const parts = [
        installed.length ? `已安装:${names}` : '',
        installed.length > 1 ? `(${installed.length} 个)` : '',
        errors.length ? `失败 ${errors.length} 个` : '',
      ].filter(Boolean);
      set({
        installing: false,
        scripts: await sourceService.listScripts(),
        lastResult: parts.join(' ') || null,
        error: installed.length ? null : (parts.join(' ') || '导入失败'),
      });
      return installed.length > 0;
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
