/* NavBar：吸顶标题栏。空间常驻（由页面 headers 占位），初始透明，
 * 透明度由 App 根据滚动折叠偏移驱动（0→1）。 */
export interface NavBarProps {
  title: string;
  safeTop: number;
  opacity: number;
}

export function NavBar({ title, safeTop, opacity }: NavBarProps) {
  return (
    <view
      className="HeaderBand"
      style={{ paddingTop: `${safeTop}px`, opacity }}
    >
      <view className="HeaderBandTitleRow">
        <text className="HeaderBandTitle">{title}</text>
      </view>
    </view>
  );
}
