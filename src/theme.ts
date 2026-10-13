/* 主题系统 —— 语义色调映射（JS/SVG 侧引用）。
 *
 * 色值 token 的唯一数据源是 App.css 顶部 `page { --xxx: ... }` 声明块
 * （浅色默认 + @media (prefers-color-scheme: dark) 覆盖）。
 * 这里只做「语义名 → CSS 变量」的映射，供 Icon 等组件在 SVG 属性里引用
 * （Lynx SVG 的 stroke/fill 支持 CSS var()，深浅色切换由浏览器/引擎自动完成）。
 *
 * 新增主题：只需在 App.css 里增加一组 media query 变量覆盖，组件零改动。 */

export const color = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  tertiary: 'var(--text-tertiary)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  /** 彩色图标块上的白色图案（不随主题变） */
  onAccent: '#ffffff',
} as const;

export type ColorTone = keyof typeof color;
