/* TabBar：悬浮胶囊底部导航 */
import { Icon } from './Icon.js';
import { IconMusic, IconGear } from '../icons/icons.js';

export type TabName = 'library' | 'settings';

const TABS: { key: TabName; label: string; Icon: typeof IconMusic }[] = [
  { key: 'library', label: '音乐库', Icon: IconMusic },
  { key: 'settings', label: '设置', Icon: IconGear },
];

export interface TabBarProps {
  active: TabName;
  onSwitch: (t: TabName) => void;
}

export function TabBar({ active, onSwitch }: TabBarProps) {
  return (
    <view className="TabBarWrap">
      <view className="TabBar">
        {TABS.map(({ key, label, Icon: IconDef }) => (
          <view
            key={key}
            className={active === key ? 'TabItem active' : 'TabItem'}
            bindtap={() => onSwitch(key)}
          >
            <view className={active === key ? 'TabIcon active' : 'TabIcon'}>
              <Icon def={IconDef} size={19} tone={active === key ? 'accent' : 'secondary'} />
            </view>
            <text className={active === key ? 'TabLabel active' : 'TabLabel'}>{label}</text>
          </view>
        ))}
      </view>
    </view>
  );
}
