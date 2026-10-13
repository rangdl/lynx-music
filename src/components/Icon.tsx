/* Icon：统一图标渲染组件。
 * tone 引用主题 CSS 变量（深浅色自动跟随）。
 * 注意：Lynx Web 端 x-svg 会把 content 转成 <img> 渲染，SVG 属性里的
 * var() 解析不到页面变量会回退黑色——深色模式下 tone 为 primary 的图标
 * 会偏暗，已知限制，待后续用双节点方案修复。 */
import { IconSvg } from '../icons.js';
import type { IconDef } from '../icons.js';
import { color } from '../theme.js';

export interface IconProps {
  def: IconDef;
  size?: number;
  /** 语义色调，映射到主题变量；也可直接传具体色值覆盖 */
  tone?: keyof typeof color | string;
}

export function Icon({ def, size = 18, tone = 'primary' }: IconProps) {
  const c = (color as Record<string, string>)[tone ?? ''] ?? tone;
  return <IconSvg def={def} size={size} color={c} />;
}
