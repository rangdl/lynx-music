/* 音乐库页：搜索框 + 分类入口 + 歌曲列表 */
import { Icon } from '../components/Icon.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import {
  IconSearch, IconDisc, IconMic, IconNote, IconPlaylist, IconPlay,
} from '../icons/icons.js';
import { CATEGORIES, PLAYLIST } from '../../data/settings.js';
import type { Song } from '../../data/settings.js';
import { usePlayerStore } from '../../state/playerStore.js';

export interface LibraryPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
  currentId: number | null;
  playing: boolean;
  onTapSong: (id: number) => void;
}

export function LibraryPage(props: LibraryPageProps) {
  const { safeTop, onOffsetChange, currentId, playing, onTapSong } = props;
  const error = usePlayerStore((s) => s.error);
  const clearError = usePlayerStore((s) => s.clearError);

  function handleDismissError() {
    'background only';
    clearError();
  }

  return (
    <CollapsiblePage title="音乐库" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      {/* 搜索框 */}
      <view className="SearchBox">
        <view className="SearchIcon"><Icon def={IconSearch} size={17} tone="secondary" /></view>
        <text className="SearchPlaceholder">搜索</text>
      </view>

      {/* 2x2 分类入口 */}
      <view className="Grid">
        {CATEGORIES.map(({ Icon: CatIcon, label }) => (
          <view key={label} className="Card">
            <view className="CardIcon"><Icon def={CatIcon} size={22} tone="primary" /></view>
            <text className="CardLabel">{label}</text>
          </view>
        ))}
      </view>

      {/* 取链错误提示(一次性) */}
      {error ? (
        <view className="ErrBar">
          <text className="ErrMsg">{error}</text>
          <view className="RetryBtn" bindtap={handleDismissError}>
            <text className="RetryIcon">知道了</text>
          </view>
        </view>
      ) : (
        <SongList currentId={currentId} playing={playing} onTapSong={onTapSong} />
      )}
    </CollapsiblePage>
  );
}

function SongList({ currentId, playing, onTapSong }: {
  currentId: number | null; playing: boolean; onTapSong: (id: number) => void;
}) {
  function handleTap(e: { currentTarget: { dataset: Record<string, string> } }) {
    'background only';
    onTapSong(Number(e.currentTarget.dataset.id));
  }

  return (
    <view className="Section">
      <text className="SectionTitle">最近添加</text>
      <view className="SongCard">
        {PLAYLIST.map((song: Song) => (
          <view
            key={song.id}
            data-id={song.id}
            className={song.id === currentId ? 'Song active' : 'Song'}
            bindtap={handleTap}
          >
            {song.id === currentId && playing ? (
              <view className="SongIndex"><Icon def={IconPlay} size={12} tone="accent" /></view>
            ) : (
              <text className="SongIndex">{String(song.id)}</text>
            )}
            <view className="SongMeta">
              <text className="SongTitle">{song.title}</text>
              <text className="SongArtist">{song.artist}</text>
            </view>
            <text className="SongDuration">{song.duration}</text>
          </view>
        ))}
      </view>
    </view>
  );
}
