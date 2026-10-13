/* 主题状态管理（JS 单一事实源）。
 *
 * 为什么不用 CSS @media：Web 预览端 Lynx CSS 管线丢弃 media query（实测
 * shadow 内 mediaCount=0），SVG 属性里的 var() 也因 <img> 化而失效。
 * 因此主题由 JS 状态驱动：useTheme() 返回当前主题，组件按主题取具体色值。
 *
 * 系统跟随：
 * - Web：matchMedia 可用，实时跟随系统
 * - 原生引擎：无 matchMedia，默认浅色；将来由宿主 NativeModules 通知
 *   （setTheme 可注入） */

import { useEffect, useState } from '@lynx-js/react';

export type ThemeName = 'light' | 'dark';

let listeners: ((t: ThemeName) => void)[] = [];
let current: ThemeName = 'light';

const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
if (query) {
  current = query.matches ? 'dark' : 'light';
  query.addEventListener('change', (e) => setTheme(e.matches ? 'dark' : 'light'));
}

export function getTheme(): ThemeName {
  return current;
}

/** 宿主/调试用：手动切主题 */
export function setTheme(t: ThemeName) {
  current = t;
  listeners.forEach((l) => l(t));
}

export function useTheme(): ThemeName {
  const [theme, setLocal] = useState<ThemeName>(current);
  useEffect(() => {
    const l = (t: ThemeName) => setLocal(t);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  return theme;
}

/** 语义色 → 当前主题具体色值（SVG 属性不能用 var()，必须给死值） */
const TONES: Record<ThemeName, Record<string, string>> = {
  light: {
    primary: '#1c1c1e',
    secondary: '#8e8e93',
    tertiary: '#a0a0a8',
    accent: '#e5484d',
    success: '#34c759',
    onAccent: '#ffffff',
  },
  dark: {
    primary: '#f2f2f7',
    secondary: '#98989e',
    tertiary: '#7c7c82',
    accent: '#ff5a5f',
    success: '#34c759',
    onAccent: '#ffffff',
  },
};

export function resolveColor(tone: string, theme: ThemeName): string {
  if (tone.startsWith('#')) return tone;
  return TONES[theme][tone] ?? TONES[theme].primary;
}
