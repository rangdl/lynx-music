/* App：组合层 —— 只负责状态、Tab 切换与页面拼装，UI 细节在各组件/页面里 */
import { useCallback, useState } from '@lynx-js/react';
import './App.css';
import { NavBar } from './components/NavBar.js';
import { TabBar } from './components/TabBar.js';
import { MiniPlayer } from './components/MiniPlayer.js';
import { LibraryPage } from './pages/LibraryPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { initialToggles, PLAYLIST } from './data/settings.js';
import { useTheme } from './useTheme.js';
import type { TabName } from './components/TabBar.js';

/** 安全区回退值：真机由宿主 NativeModules.SafeArea 注入；开源版无 getSystemInfoSync，不可依赖 */
const DEFAULT_SAFE_TOP = 47;
/** 标题栏内容高度（安全区之下） */
const NAV_BAR_HEIGHT = 44;

function readSafeTop(): number {
  try {
    const v = (globalThis as unknown as {
      NativeModules?: { SafeArea?: { getTop?: () => number } };
    }).NativeModules?.SafeArea?.getTop?.();
    return typeof v === 'number' && v > 0 ? v : DEFAULT_SAFE_TOP;
  } catch {
    return DEFAULT_SAFE_TOP;
  }
}


export function App() {
  const theme = useTheme();
  const [tab, setTab] = useState<TabName>('library');
  const [navOpacity, setNavOpacity] = useState(0);
  const [currentId, setCurrentId] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [serverOk, setServerOk] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>(initialToggles);

  const safeTop = readSafeTop();
  const current = PLAYLIST.find((s) => s.id === currentId)!;

  const onTapSong = useCallback((id: number) => {
    'background only';
    setCurrentId((prev) => {
      if (prev === id) {
        setPlaying((p) => !p);
        return prev;
      }
      setPlaying(true);
      return id;
    });
  }, []);

  const onTogglePlay = useCallback(() => {
    'background only';
    setPlaying((p) => !p);
  }, []);

  const onNext = useCallback(() => {
    'background only';
    setCurrentId((prev) => (prev % PLAYLIST.length) + 1);
    setPlaying(true);
  }, []);

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

  const onRetry = useCallback(() => {
    'background only';
    if (retrying) return;
    setRetrying(true);
    setTimeout(() => {
      setServerOk(true);
      setRetrying(false);
    }, 900);
  }, [retrying]);

  return (
    <view className={theme === 'dark' ? 'Page theme-dark' : 'Page theme-light'}>
      <NavBar
        title={tab === 'library' ? '音乐库' : '设置'}
        safeTop={safeTop}
        opacity={navOpacity}
      />

      {tab === 'library' ? (
        <LibraryPage
          safeTop={safeTop}
          onOffsetChange={onOffsetChange}
          serverOk={serverOk}
          retrying={retrying}
          onRetry={onRetry}
          currentId={currentId}
          playing={playing}
          onTapSong={onTapSong}
        />
      ) : (
        <SettingsPage
          safeTop={safeTop}
          onOffsetChange={onOffsetChange}
          toggles={toggles}
          onToggle={onToggle}
        />
      )}

      <MiniPlayer
        title={current.title}
        artist={current.artist}
        playing={playing}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
      />

      <TabBar active={tab} onSwitch={onSwitchTab} />
    </view>
  );
}

