/* 数据与配置：歌曲、分类、设置分组（UI 结构与业务数据分离） */
import {
  IconDisc, IconMic, IconNote, IconPlaylist, IconMusic,
  IconImport, IconUserSplit, IconCopy, IconBolt, IconClockSync, IconStar,
  IconSparkle, IconQuote, IconGrid, IconGlobe, IconBackup, IconUpload,
  IconDolby, IconBitPerfect, IconInfo,
} from '../ui/icons/icons.js';
import type { IconDef } from '../ui/icons/icons.js';
import type { RowControl } from '../ui/components/SwitchRow.js';

export interface Song {
  id: number;
  title: string;
  artist: string;
  duration: string;
}

export const PLAYLIST: Song[] = [
  { id: 1, title: '夜空中最亮的星', artist: '逃跑计划', duration: '4:12' },
  { id: 2, title: '成都', artist: '赵雷', duration: '5:28' },
  { id: 3, title: '海阔天空', artist: 'Beyond', duration: '5:24' },
  { id: 4, title: '平凡之路', artist: '朴树', duration: '5:01' },
  { id: 5, title: '遇见', artist: '孙燕姿', duration: '4:14' },
];

export const CATEGORIES: { Icon: IconDef; label: string }[] = [
  { Icon: IconDisc, label: '专辑' },
  { Icon: IconMic, label: '歌手' },
  { Icon: IconNote, label: '歌曲' },
  { Icon: IconPlaylist, label: '歌单' },
];

export interface SettingItem {
  key: string;
  Icon: IconDef;
  iconColor: string;
  title: string;
  desc: string;
  /** 默认开态（仅 toggle） */
  on?: boolean;
  /** 固定值文案（仅 value 型） */
  value?: string;
  /** 生成右侧控件；onToggle 由页面注入，保持数据纯静态 */
  control: (on: boolean, onToggle: () => void) => RowControl;
}

export interface SettingGroup {
  title: string;
  items: SettingItem[];
}

const toggle = (on?: boolean) => (on: boolean, onToggle: () => void): RowControl => ({ type: 'toggle', on, onToggle });
const link = () => (_on: boolean, _onToggle: () => void): RowControl => ({ type: 'link' });
const value = (v: string) => (_on: boolean, _onToggle: () => void): RowControl => ({ type: 'value', value: v });

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: '音乐库',
    items: [
      { key: 'import', Icon: IconImport, iconColor: '#e5484d', title: '导入音乐', desc: '导入本地或云端音乐', control: link() },
      { key: 'sep', Icon: IconUserSplit, iconColor: '#3b82f6', title: '歌手分隔标记', desc: '选择歌手元数据分隔标记', control: link() },
      { key: 'dup', Icon: IconCopy, iconColor: '#3a3a3c', title: '隐藏重复', desc: '开启之后，应用将按照歌名与歌手隐藏重复的歌曲。应用会优先考虑本地歌曲', control: toggle(true) },
      { key: 'fast', Icon: IconBolt, iconColor: '#f59e0b', title: '快速排序', desc: '开启此设置可以缩短应用启动时间，但会影响数字排序逻辑。听有声书的用户建议关闭', control: toggle(false) },
      { key: 'auto', Icon: IconClockSync, iconColor: '#8e8e93', title: '自动获取新歌曲', desc: '自动获取 Plex，Emby 跟 Navidrome 服务器上新添加的歌曲。注意：如果需要更新现有的歌曲，请同步服务器。', control: value('每周') },
    ],
  },
  {
    title: '歌单',
    items: [
      { key: 'fav', Icon: IconStar, iconColor: '#f59e0b', title: '使用收藏功能', desc: '开启媒体服务器收藏功能', control: toggle(true) },
      { key: 'ai', Icon: IconSparkle, iconColor: '#7c3aed', title: 'AI歌单', desc: '通过使用数据创建智能歌单', control: link() },
    ],
  },
  {
    title: 'API',
    items: [
      { key: 'lyric', Icon: IconQuote, iconColor: '#4cb2c9', title: '歌词 API', desc: '添加歌词 API，自动寻找歌词', control: link() },
      { key: 'cover', Icon: IconGrid, iconColor: '#5cb85c', title: '封面 API', desc: '添加封面 API，自动寻找封面', control: link() },
      { key: 'source', Icon: IconMusic, iconColor: '#e5484d', title: '音源 API', desc: '管理 lx 音源脚本与取链接服务', control: link() },
    ],
  },
  {
    title: '其它',
    items: [
      { key: 'lmp', Icon: IconGlobe, iconColor: '#3b82f6', title: 'LMP助手', desc: '通过电脑浏览器管理本地音乐文件', control: link() },
      { key: 'backup', Icon: IconBackup, iconColor: '#e5484d', title: '备份管理', desc: '备份 / 恢复账号与歌单', control: link() },
      { key: 'lastfm', Icon: IconUpload, iconColor: '#d2232a', title: 'Last.fm', desc: '登录并上传数据到 Last.fm', control: link() },
      { key: 'dolby', Icon: IconDolby, iconColor: '#1c1c1e', title: '支持杜比全景声', desc: '开启 Dolby Atmos 支持。播放支持 Dolby Atmos 的音频时，均衡器将无法使用', control: toggle(false) },
      { key: 'bitperfect', Icon: IconBitPerfect, iconColor: '#6f42c1', title: '使用 Bit Perfect', desc: '开启后，本地歌曲播放时不做额外处理。均衡器与速度调整将无法使用', control: toggle(false) },
      { key: 'ui', Icon: IconGrid, iconColor: '#e8930c', title: '定制 UI', desc: '更改界面风格与操作逻辑', control: link() },
      { key: 'about', Icon: IconInfo, iconColor: '#8e8e93', title: '关于应用', desc: '应用信息与隐私政策', control: link() },
    ],
  },
];

/** 从分组数据推导开关初始状态 */
export function initialToggles(): Record<string, boolean> {
  return Object.fromEntries(
    SETTING_GROUPS.flatMap((g) => g.items)
      .filter((s) => typeof s.on === 'boolean')
      .map((s) => [s.key, s.on as boolean]),
  );
}
