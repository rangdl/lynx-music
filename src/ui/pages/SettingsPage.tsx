/* 设置页：分组条目列表 */
import { SwitchRow } from '../components/SwitchRow.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import { SourceManagePage } from './SourceManagePage.js';
import { NetDiagPage } from './NetDiagPage.js';
import { SETTING_GROUPS } from '../../data/settings.js';
import { useTheme, setTheme } from '../theme/useTheme.js';

export type SettingsSub = 'main' | 'sources' | 'netdiag';

export interface SettingsPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
  /** 子页面:音源管理 / 网络诊断(状态提升至 App 以驱动 NavBar 标题) */
  sub: SettingsSub;
  onSubChange: (s: SettingsSub) => void;
}

export function SettingsPage({ safeTop, onOffsetChange, toggles, onToggle, sub, onSubChange }: SettingsPageProps) {
  const theme = useTheme();

  // 子页面:复用独立页面组件,顶部返回行由各子组件外层包裹
  if (sub === 'sources') {
    return (
      <view className="SubPageWrap">
        <SubPageBack title="音源管理" safeTop={safeTop} onBack={() => onSubChange('main')} />
        <SourceManagePage safeTop={safeTop} onOffsetChange={onOffsetChange} />
      </view>
    );
  }
  if (sub === 'netdiag') {
    return (
      <view className="SubPageWrap">
        <SubPageBack title="网络诊断" safeTop={safeTop} onBack={() => onSubChange('main')} />
        <NetDiagPage safeTop={safeTop} onOffsetChange={onOffsetChange} />
      </view>
    );
  }

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
            {group.items.map((item, idx) => {
              // 外观条目的值动态显示当前主题;页面注入的行级回调(数据层保持纯静态):
              // 外观=切换主题,音源API/网络诊断=进入子页
              const control = item.key === 'appearance'
                ? { type: 'value' as const, value: theme === 'light' ? '浅色' : '深色' }
                : item.control(toggles[item.key] ?? false, () => onToggle(item.key));
              const onTapRow: Record<string, () => void> = {
                appearance: () => setTheme(theme === 'light' ? 'dark' : 'light'),
                source: () => onSubChange('sources'),
                netdiag: () => onSubChange('netdiag'),
              };
              return (
                <view key={item.key}>
                  <SwitchRow
                    icon={item.Icon}
                    iconColor={item.iconColor}
                    title={item.title}
                    desc={item.desc}
                    control={control}
                    onTapRow={onTapRow[item.key]}
                  />
                  {idx < group.items.length - 1 && <view className="Divider" />}
                </view>
              );
            })}
          </view>
        </view>
      ))}
    </CollapsiblePage>
  );
}

/** 子页顶部返回行:与 Group 卡片风格一致的返回入口 */
function SubPageBack({ title, safeTop, onBack }: { title: string; safeTop: number; onBack: () => void }) {
  function handleBack() {
    'background only';
    onBack();
  }
  return (
    <view className="SubPageBack" style={{ paddingTop: `${safeTop}px` }}>
      <view className="SubPageBackBtn" bindtap={handleBack}>
        <text className="SubPageBackText">‹ 返回设置</text>
      </view>
    </view>
  );
}
