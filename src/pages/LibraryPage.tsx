/* 音乐库页：搜索框 + 分类入口 + 连接状态/歌曲列表 */
import { Icon } from '../components/Icon.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import {
  IconSearch, IconDisc, IconMic, IconNote, IconPlaylist, IconBell, IconPlay,
} from '../icons.js';
import { CATEGORIES, PLAYLIST } from '../data/settings.js';
import type { Song } from '../data/settings.js';

export interface LibraryPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
  serverOk: boolean;
  retrying: boolean;
  onRetry: () => void;
  currentId: number;
  playing: boolean;
  onTapSong: (id: number) => void;
}

export function LibraryPage(props: LibraryPageProps) {
  const { safeTop, onOffsetChange, serverOk, retrying, onRetry, currentId, playing, onTapSong } = props;
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

      {/* 服务器连接状态 */}
      {!serverOk ? (
        <view className="ErrBar">
          <view className="ErrIcon"><Icon def={IconBell} size={18} tone="secondary" /></view>
          <text className="ErrMsg">无法连接音源服务 lx-runner</text>
          <view className="RetryBtn" bindtap={onRetry}>
            <text className="RetryIcon">{retrying ? '…' : '重试'}</text>
          </view>
        </view>
      ) : (
        <SongList currentId={currentId} playing={playing} onTapSong={onTapSong} />
      )}
    </CollapsiblePage>
  );
}

function SongList({ currentId, playing, onTapSong }: {
  currentId: number; playing: boolean; onTapSong: (id: number) => void;
}) {
  return (
    <view className="Section">
      <text className="SectionTitle">最近添加</text>
      <view className="SongCard">
        {PLAYLIST.map((song: Song) => (
          <view
            key={song.id}
            className={song.id === currentId ? 'Song active' : 'Song'}
            bindtap={() => onTapSong(song.id)}
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
