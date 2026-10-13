/* 设置页：分组条目列表 */
import { SwitchRow } from '../components/SwitchRow.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import { SETTING_GROUPS } from '../data/settings.js';

export interface SettingsPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function SettingsPage({ safeTop, onOffsetChange, toggles, onToggle }: SettingsPageProps) {
  return (
    <CollapsiblePage title="设置" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      {SETTING_GROUPS.map((group) => (
        <view key={group.title} className="Group">
          <text className="GroupTitle">{group.title}</text>
          <view className="GroupBody">
            {group.items.map((item, idx) => (
              <view key={item.key}>
                <SwitchRow
                  icon={item.Icon}
                  iconColor={item.iconColor}
                  title={item.title}
                  desc={item.desc}
                  control={item.control(toggles[item.key] ?? false, () => onToggle(item.key))}
                />
                {idx < group.items.length - 1 && <view className="Divider" />}
              </view>
            ))}
          </view>
        </view>
      ))}
    </CollapsiblePage>
  );
}
