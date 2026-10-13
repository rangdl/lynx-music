/* App：组合层 —— Provider/页面拼装,业务状态全部在 state/ store(架构文档 §4)。 */
import { useCallback, useState } from '@lynx-js/react';
import './App.css';
import { NavBar } from './ui/components/NavBar.js';
import { TabBar } from './ui/components/TabBar.js';
import { MiniPlayer } from './ui/components/MiniPlayer.js';
import { LibraryPage } from './ui/pages/LibraryPage.js';
import { SettingsPage } from './ui/pages/SettingsPage.js';
import { SourceManagePage } from './ui/pages/SourceManagePage.js';
import { initialToggles } from './data/settings.js';
import { useTheme } from './ui/theme/useTheme.js';
import { usePlayerStore } from './state/playerStore.js';
import { readSafeTop } from './platform/index.js';
import type { TabName } from './ui/components/TabBar.js';

export function App() {
  const theme = useTheme();
  const [tab, setTab] = useState<TabName>('library');
  const [navOpacity, setNavOpacity] = useState(0);
  const [toggles, setToggles] = useState<Record<string, boolean>>(initialToggles);

  const currentId = usePlayerStore((s) => s.currentId);
  const playing = usePlayerStore((s) => s.playing);
  const resolving = usePlayerStore((s) => s.resolving);
  const queue = usePlayerStore((s) => s.queue);
  const play = usePlayerStore((s) => s.play);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);

  const safeTop = readSafeTop();
  const current = queue.find((s) => s.id === currentId) ?? queue[0];

  const onTapSong = useCallback((id: number) => {
    'background only';
    play(id);
  }, [play]);

  const onToggle = useCallback((key: string) => {
    'background only';
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const onSwitchTab = useCallback((t: TabName) => {
    'background only';
    setTab(t);
    setNavOpacity(0); // 切页后重置吸顶栏渐显
  }, []);

  // ScrollCoordinator 折叠偏移 → 吸顶栏透明度（0→1 线性）
  const onOffsetChange = useCallback((e: { offset: number; height: number }) => {
    'background only';
    setNavOpacity(e.height > 0 ? Math.max(0, Math.min(1, e.offset / e.height)) : 1);
  }, []);

  const title = tab === 'library' ? '音乐库' : tab === 'settings' ? '设置' : '音源管理';

  return (
    <view className={theme === 'dark' ? 'Page theme-dark' : 'Page theme-light'}>
      <NavBar title={title} safeTop={safeTop} opacity={navOpacity} />

      {tab === 'library' ? (
        <LibraryPage
          safeTop={safeTop}
          onOffsetChange={onOffsetChange}
          currentId={currentId}
          playing={playing}
          onTapSong={onTapSong}
        />
      ) : tab === 'settings' ? (
        <SettingsPage
          safeTop={safeTop}
          onOffsetChange={onOffsetChange}
          toggles={toggles}
          onToggle={onToggle}
        />
      ) : (
        <SourceManagePage safeTop={safeTop} onOffsetChange={onOffsetChange} />
      )}

      <MiniPlayer
        title={current?.title ?? '未在播放'}
        artist={resolving ? '取链中…' : current?.artist ?? ''}
        playing={playing}
        onTogglePlay={togglePlay}
        onNext={next}
      />

      <TabBar active={tab} onSwitch={onSwitchTab} />
    </view>
  );
}
