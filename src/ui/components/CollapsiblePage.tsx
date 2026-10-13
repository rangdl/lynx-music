/* CollapsiblePage：ScrollCoordinator 封装。
 * 统一处理：headers（大标题+安全区占位）、slot（滚动内容）、底部遮挡留白。
 * 吸顶栏渐显由父级通过 onOffsetChange 驱动（见 App.tsx）。 */
import type { ReactNode } from '@lynx-js/react';
import { ScrollCoordinator } from '@lynx-js/lynx-ui-scroll-coordinator';
import { ScrollView } from '@lynx-js/lynx-ui-scroll-view';

export interface CollapsiblePageProps {
  title: string;
  safeTop: number;
  /** 折叠偏移回调（驱动吸顶栏渐显） */
  onOffsetChange: (e: { offset: number; height: number }) => void;
  children: ReactNode;
}

export function CollapsiblePage({ title, safeTop, onOffsetChange, children }: CollapsiblePageProps) {
  return (
    <ScrollCoordinator
      className="Scroll"
      onOffsetChange={onOffsetChange}
      headers={
        <view>
          <view style={{ height: `${safeTop}px` }} />
          <text className="BigTitle">{title}</text>
        </view>
      }
      slot={(
        <ScrollView className="ScrollSlot" scroll-orientation="vertical">
          {children}
          {/* 底部留白：滚到底时内容不被迷你播放条/导航遮挡（Lynx 原生引擎不支持 :last-child，用显式占位） */}
          <view className="ScrollSpacer" />
        </ScrollView>
      )}
    />
  );
}
