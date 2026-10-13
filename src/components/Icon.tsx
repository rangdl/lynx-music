/* Icon：统一图标渲染组件。按当前主题渲染单个 SVG（具体色值），
 * 主题来源见 useTheme.ts（CSS media 在 Web 预览端不可用的结论见其头注释）。 */
import { IconSvg } from '../icons.js';
import type { IconDef } from '../icons.js';
import { useTheme, resolveColor } from '../useTheme.js';

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
