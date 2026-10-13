/* 主题状态管理（JS 单一事实源）。
 *
 * 为什么不用 CSS @media（已实测确认，勿再走回头路）：
 * 1. Web 预览端 web-core 编码器把 @media 硬编码为 unrepresentable，
 *    构建期直接剥离（web-core/encode_prod/index.js:871），CSS media 永不生效
 * 2. Lynx 后台线程无 matchMedia（实测 typeof = undefined），JS 无法感知系统主题
 * 3. SVG 属性里的 var() 因 x-svg 的 <img> 化渲染解析不到页面变量
 *
 * 因此：主题 = JS 状态，默认 light；切换入口：
 * - 开发/预览：设置页「外观」条目手动切换
 * - 生产：宿主通过 globalProps / NativeModules 调 setTheme() */

import { useEffect, useState } from '@lynx-js/react';

export type ThemeName = 'light' | 'dark';

let listeners: ((t: ThemeName) => void)[] = [];
let current: ThemeName = 'light';

export function getTheme(): ThemeName {
  return current;
}

/** 宿主/调试入口：切换主题并通知所有订阅者 */
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

/** 语义色调 → 当前主题下的具体色值（SVG 属性必须给死值，见上） */
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
