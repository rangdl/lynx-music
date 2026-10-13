/* MiniPlayer：悬浮迷你播放条（两 Tab 共用） */
import { Icon } from './Icon.js';
import { IconNote, IconPlay, IconPause, IconNext } from '../icons/icons.js';

export interface MiniPlayerProps {
  title: string;
  artist: string;
  playing: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
}

export function MiniPlayer({ title, artist, playing, onTogglePlay, onNext }: MiniPlayerProps) {
  return (
    <view className="MiniPlayer">
      <view className={playing ? 'MiniDisc spinning' : 'MiniDisc'}>
        <view className="MiniDiscIcon"><Icon def={IconNote} size={20} tone="onAccent" /></view>
      </view>
      <view className="MiniInfo">
        <text className="MiniTitle">{title}</text>
        <text className="MiniArtist">{artist}</text>
      </view>
      <view className="MiniBtn" bindtap={onTogglePlay}>
        <view className="MiniBtnIcon">
          <Icon def={playing ? IconPause : IconPlay} size={20} tone="primary" />
        </view>
      </view>
      <view className="MiniBtn" bindtap={onNext}>
        <view className="MiniBtnIcon"><Icon def={IconNext} size={20} tone="primary" /></view>
      </view>
    </view>
  );
}
