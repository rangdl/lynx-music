/* Icon：统一图标渲染组件。
 * 按当前主题（JS 状态，见 useTheme.ts）渲染单个 SVG、给具体色值。
 * 不用 CSS var()：x-svg 的 <img> 化渲染解析不到页面变量；
 * 不用 @media：Web 预览端构建期被剥离、后台线程无 matchMedia（实测）。 */
import { IconSvg } from '../icons/icons.js';
import type { IconDef } from '../icons/icons.js';
import { useTheme, resolveColor } from '../theme/useTheme.js';

export interface IconProps {
  def: IconDef;
  size?: number;
  /** 语义色调（primary/secondary/accent/onAccent...）或 #字面色值 */
  tone?: string;
}

export function Icon({ def, size = 18, tone = 'primary' }: IconProps) {
  const theme = useTheme();
  return <IconSvg def={def} size={size} color={resolveColor(tone, theme)} />;
}
