/* 统一图标库 —— path 数据来自 Lucide (https://lucide.dev, ISC License)。
 * Lynx <svg content="XML 字符串"> 模式：整图由后台线程渲染为单个原生视图。
 * 颜色必须显式传入（不支持 currentColor）。
 * 使用：<IconSvg def={IconSearch} size={17} color="#8e8e93" /> */

export type IconDef = (size: number, color: string) => string;

function strokeSvg(size: number, color: string, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function fillSvg(size: number, color: string, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="none">${inner}</svg>`;
}

export function IconSvg({ def, size = 18, color = '#000000' }: { def: IconDef; size?: number; color?: string }) {
  return (
    <svg
      content={def(size, color)}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

export const IconSearch: IconDef = (s, c) => strokeSvg(s, c, `<path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />`);

export const IconDisc: IconDef = (s, c) => strokeSvg(s, c, `<circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="2" />`);

export const IconMic: IconDef = (s, c) => strokeSvg(s, c, `<path d="M12 19v3" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <rect x="9" y="2" width="6" height="13" rx="3" />`);

export const IconNote: IconDef = (s, c) => strokeSvg(s, c, `<path d="M9 18V5l12-2v13" /> <circle cx="6" cy="18" r="3" /> <circle cx="18" cy="16" r="3" />`);

export const IconPlaylist: IconDef = (s, c) => strokeSvg(s, c, `<path d="M16 5H3" /> <path d="M11 12H3" /> <path d="M11 19H3" /> <path d="M21 16V5" /> <circle cx="18" cy="16" r="3" />`);

export const IconBell: IconDef = (s, c) => strokeSvg(s, c, `<path d="M10.268 21a2 2 0 0 0 3.464 0" /> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />`);

export const IconPlay: IconDef = (s, c) => fillSvg(s, c, `<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />`);

export const IconPause: IconDef = (s, c) => fillSvg(s, c, `<rect x="14" y="3" width="5" height="18" rx="1" /> <rect x="5" y="3" width="5" height="18" rx="1" />`);

export const IconNext: IconDef = (s, c) => strokeSvg(s, c, `<path d="M21 4v16" /> <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />`);

export const IconMusic: IconDef = (s, c) => strokeSvg(s, c, `<circle cx="8" cy="18" r="4" /> <path d="M12 18V2l7 4" />`);

export const IconGear: IconDef = (s, c) => strokeSvg(s, c, `<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /> <circle cx="12" cy="12" r="3" />`);

export const IconImport: IconDef = (s, c) => strokeSvg(s, c, `<path d="M12 3v12" /> <path d="m8 11 4 4 4-4" /> <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />`);

export const IconUserSplit: IconDef = (s, c) => strokeSvg(s, c, `<circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />`);

export const IconCopy: IconDef = (s, c) => strokeSvg(s, c, `<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />`);

export const IconBolt: IconDef = (s, c) => strokeSvg(s, c, `<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />`);

export const IconClockSync: IconDef = (s, c) => strokeSvg(s, c, `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />`);

export const IconStar: IconDef = (s, c) => strokeSvg(s, c, `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />`);

export const IconSparkle: IconDef = (s, c) => strokeSvg(s, c, `<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />`);

export const IconQuote: IconDef = (s, c) => strokeSvg(s, c, `<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /> <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />`);

export const IconGrid: IconDef = (s, c) => strokeSvg(s, c, `<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" />`);

export const IconGlobe: IconDef = (s, c) => strokeSvg(s, c, `<circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" />`);

export const IconBackup: IconDef = (s, c) => strokeSvg(s, c, `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />`);

export const IconUpload: IconDef = (s, c) => strokeSvg(s, c, `<path d="M12 3v12" /> <path d="m17 8-5-5-5 5" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />`);

export const IconDolby: IconDef = (s, c) => strokeSvg(s, c, `<rect width="16" height="20" x="4" y="2" rx="2" /> <path d="M12 6h.01" /> <circle cx="12" cy="14" r="4" /> <path d="M12 14h.01" />`);

export const IconBitPerfect: IconDef = (s, c) => strokeSvg(s, c, `<path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />`);

export const IconInfo: IconDef = (s, c) => strokeSvg(s, c, `<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />`);
