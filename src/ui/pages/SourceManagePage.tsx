/* 音源管理页:脚本导入(粘贴/URL/压缩包 URL)/启停/删除。 */
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
  const lastResult = useSourceStore((s) => s.lastResult);
  const refresh = useSourceStore((s) => s.refresh);
  const installFromCode = useSourceStore((s) => s.installFromCode);
  const installFromUrl = useSourceStore((s) => s.installFromUrl);
  const toggle = useSourceStore((s) => s.toggle);
  const remove = useSourceStore((s) => s.remove);
  const clearError = useSourceStore((s) => s.clearError);
  // 受控输入:Lynx x-input 的 DOM value 回读不可靠(实测),值经 bindinput 事件同步
  const [draft, setDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');

  useEffect(() => {
    'background only';
    void refresh();
  }, [refresh]);

  const handleInstall = () => {
    'background only';
    if (!draft.trim()) return;
    void installFromCode(draft).then((ok) => { if (ok) setDraft(''); });
  };

  const handleInstallUrl = () => {
    'background only';
    if (!urlDraft.trim()) return;
    void installFromUrl(urlDraft.trim()).then((ok) => { if (ok) setUrlDraft(''); });
  };

  const handleInput = (e: { detail: { value: string } }) => {
    'background only';
    setDraft(e.detail.value);
  };

  const handleUrlInput = (e: { detail: { value: string } }) => {
    'background only';
    setUrlDraft(e.detail.value);
  };

  const handleToggle = (e: { currentTarget: { dataset: Record<string, string> } }) => {
    'background only';
    void toggle(e.currentTarget.dataset.id);
  };

  const handleRemove = (e: { currentTarget: { dataset: Record<string, string> } }) => {
    'background only';
    void remove(e.currentTarget.dataset.id);
  };

  const handleDismissError = () => {
    'background only';
    clearError();
  };

  return (
    <CollapsiblePage title="音源管理" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      <view className="Group">
        <text className="GroupTitle">导入脚本</text>
        <view className="GroupBody">
          {/* 方式一:粘贴脚本代码 */}
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

          {/* 方式二:URL 导入(.js 脚本或 .zip 压缩包,自动识别) */}
          <view className="SourceImport">
            <input
              className="SourceUrlInput"
              default-value={urlDraft}
              bindinput={handleUrlInput}
              placeholder="脚本或压缩包链接(.js / .zip)"
              placeholder-class="SourceInputPlaceholder"
            />
            <view className="SourceInstallBtn" bindtap={handleInstallUrl}>
              <text className="SourceInstallBtnText">{installing ? '下载中…' : '导入'}</text>
            </view>
          </view>

          {error ? (
            <view className="SourceResultRow" bindtap={handleDismissError}>
              <text className="SourceError">{error}</text>
            </view>
          ) : lastResult ? (
            <view className="SourceResultRow">
              <text className="SourceOk">{lastResult}</text>
            </view>
          ) : (
            <view />
          )}
          <text className="SourceHint">安装时会执行健康检查:脚本可运行且上报音源能力后才会启用。zip 包自动安装内含的全部 .js。</text>
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
