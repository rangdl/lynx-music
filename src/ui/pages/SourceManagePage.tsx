/* 音源管理页:脚本导入/启停/删除,粘贴脚本代码安装。 */
import { useEffect, useState } from '@lynx-js/react';
import { useSourceStore } from '../../state/sourceStore.js';
import { CollapsiblePage } from '../components/CollapsiblePage.js';

export interface SourceManagePageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
}

export function SourceManagePage({ safeTop, onOffsetChange }: SourceManagePageProps) {
  const scripts = useSourceStore((s) => s.scripts);
  const installing = useSourceStore((s) => s.installing);
  const error = useSourceStore((s) => s.error);
  const refresh = useSourceStore((s) => s.refresh);
  const installFromCode = useSourceStore((s) => s.installFromCode);
  const toggle = useSourceStore((s) => s.toggle);
  const remove = useSourceStore((s) => s.remove);
  // 受控输入:Lynx x-input 的 DOM value 回读不可靠(实测),值经 bindinput 事件同步
  const [draft, setDraft] = useState('');

  useEffect(() => {
    'background only';
    void refresh();
  }, [refresh]);

  const handleInstall = () => {
    'background only';
    if (!draft.trim()) return;
    void installFromCode(draft).then((ok) => { if (ok) setDraft(''); });
  };

  const handleInput = (e: { detail: { value: string } }) => {
    'background only';
    setDraft(e.detail.value);
  };

  const handleToggle = (e: { currentTarget: { dataset: Record<string, string> } }) => {
    'background only';
    void toggle(e.currentTarget.dataset.id);
  };

  const handleRemove = (e: { currentTarget: { dataset: Record<string, string> } }) => {
    'background only';
    void remove(e.currentTarget.dataset.id);
  };

  return (
    <CollapsiblePage title="音源管理" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      <view className="Group">
        <text className="GroupTitle">导入脚本</text>
        <view className="GroupBody">
          <view className="SourceImport">
            {/* 必须 textarea:实测单行 input 会把粘贴文本的换行替换成空格,
                音源脚本头部注释(@name/@version)因此解析不出来 */}
            <textarea
              className="SourceInput"
              default-value={draft}
              bindinput={handleInput}
              placeholder="粘贴 lx 音源脚本代码"
              placeholder-class="SourceInputPlaceholder"
            />
            <view className="SourceInstallBtn" bindtap={handleInstall}>
              <text className="SourceInstallBtnText">{installing ? '检查中…' : '安装'}</text>
            </view>
          </view>
          {error ? <text className="SourceError">{error}</text> : <view />}
          <text className="SourceHint">安装时会执行健康检查:脚本可运行且上报音源能力后才会启用。</text>
        </view>
      </view>

      <view className="Group">
        <text className="GroupTitle">已安装({scripts.length})</text>
        <view className="GroupBody">
          {scripts.length === 0 ? (
            <text className="SourceEmpty">尚未安装任何脚本</text>
          ) : (
            scripts.map((s) => (
              <view key={s.id}>
                <view className="SourceRow">
                  <view className="SourceInfo">
                    <text className="SourceName">{s.name} v{s.version}</text>
                    <text className="SourceMeta">{Object.keys(s.sources).join(' / ') || '无音源'}</text>
                  </view>
                  <view className="SourceRowBtn" data-id={s.id} bindtap={handleToggle}>
                    <text className="SourceRowBtnText">{s.enabled ? '停用' : '启用'}</text>
                  </view>
                  <view className="SourceRowBtn SourceRowBtnDanger" data-id={s.id} bindtap={handleRemove}>
                    <text className="SourceRowBtnText">删除</text>
                  </view>
                </view>
              </view>
            ))
          )}
        </view>
      </view>
    </CollapsiblePage>
  );
}
