/* SwitchRow：设置条目行 —— 图标块 + 标题/描述 + 右侧控件（开关/值/箭头）。
 * 开关用 lynx-ui 官方 Switch（行为/手势官方负责，外观由 CSS 定制）。
 * 注意：不要在父行绑 bindtap，否则与 Switch 的 tap 冒泡叠加导致状态切换两次。 */
import { Switch, SwitchThumb, SwitchTrack } from '@lynx-js/lynx-ui';
import { Icon } from './Icon.js';
import type { IconDef } from '../icons/icons.js';

export type RowControl =
  | { type: 'toggle'; on: boolean; onToggle: () => void }
  | { type: 'value'; value: string }
  | { type: 'link' };

export interface SwitchRowProps {
  icon: IconDef;
  iconColor: string;
  title: string;
  desc: string;
  control: RowControl;
}

export function SwitchRow({ icon, iconColor, title, desc, control }: SwitchRowProps) {
  return (
    <view className="SettingItem">
      <view className="SettingIcon" style={{ backgroundColor: iconColor }}>
        <view className="SettingIconText"><Icon def={icon} size={16} tone="onAccent" /></view>
      </view>
      <view className="SettingBody">
        <text className="SettingTitle">{title}</text>
        <text className="SettingDesc">{desc}</text>
      </view>
      {control.type === 'toggle' ? (
        <Switch
          checked={control.on}
          onChange={control.onToggle}
          className="SettingSwitch"
        >
          <SwitchTrack className="SwitchTrack">
            <SwitchThumb className="SwitchThumb" />
          </SwitchTrack>
        </Switch>
      ) : control.type === 'value' ? (
        <text className="SettingValue">{control.value}</text>
      ) : (
        <text className="SettingArrow">›</text>
      )}
    </view>
  );
}
