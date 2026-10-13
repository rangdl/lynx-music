/* 设置页：分组条目列表 */
import { SwitchRow } from '../components/SwitchRow.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import { SETTING_GROUPS } from '../../data/settings.js';
import { useTheme, setTheme } from '../theme/useTheme.js';

export interface SettingsPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function SettingsPage({ safeTop, onOffsetChange, toggles, onToggle }: SettingsPageProps) {
  const theme = useTheme();
  return (
    <CollapsiblePage title="设置" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      {/* 开发期主题切换（生产由宿主经 setTheme 注入） */}
      <view
        className="ThemeToggle"
        bindtap={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        <text className="ThemeToggleText">
          外观：{theme === 'light' ? '浅色' : '深色'}（点按切换）
        </text>
      </view>
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
