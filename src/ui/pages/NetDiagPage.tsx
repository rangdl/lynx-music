/* 网络诊断页:逐项 fetch 探测,展示 状态码/statusText/耗时/字节数。
 * 目的:真机 fetch 499 归因。已知(GitHub lynx#798):
 * - 真机网络层是 Retrofit/OkHttp,底层异常映射为 HTTP 499,statusText 携带
 *   底层异常原文(如 java.net.SocketTimeoutException)
 * - Lynx fetch 与 Web 差异:无 CORS/redirect/keepalive/FormData/Blob;
 *   流式需 PageConfig;超时在宿主 LynxHttpService 配置
 * 本页同时验证:TextCodecHelper/TextDecoder 可用性、URL 构造函数等环境探测。 */

import { useState } from '@lynx-js/react';
import { CollapsiblePage } from '../components/CollapsiblePage.js';
import { NET_TESTS } from '../../data/netdiag.js';

export interface NetDiagPageProps {
  safeTop: number;
  onOffsetChange: (e: { offset: number; height: number }) => void;
}

/** 单项结果状态 */
interface TestState {
  status: 'idle' | 'running' | 'ok' | 'fail';
  /** HTTP 状态码(499 时为映射码) */
  code?: number;
  /** statusText:真机 499 时携带底层异常原文 —— 诊断关键 */
  statusText?: string;
  ms?: number;
  bytes?: number;
  err?: string;
}

/** 环境探测:PrimJS 与 Web 的全局差异清单 */
function probeEnv(): string[] {
  const g = globalThis as unknown as Record<string, unknown>;
  const checks: [string, unknown][] = [
    ['TextDecoder', g.TextDecoder],
    ['TextEncoder', g.TextEncoder],
    ['TextCodecHelper', g.TextCodecHelper],
    ['URL', g.URL],
    ['AbortController', g.AbortController],
    ['localStorage', g.localStorage],
    ['document(无=真机)', g.document],
  ];
  return checks.map(([k, v]) => `${k}: ${v === undefined ? '无' : typeof v}`);
}

async function runTest(url: string, method: 'GET' | 'POST'): Promise<TestState> {
  'background only';
  const t0 = Date.now();
  try {
    // 键保持干净:不传 signal/headers(空对象),变量逐一验证
    const opts: Record<string, unknown> = { method };
    const r = await fetch(url, opts as Parameters<typeof fetch>[1]);
    const ms = Date.now() - t0;
    let bytes = 0;
    try {
      if (typeof r.arrayBuffer === 'function') {
        const buf = await r.arrayBuffer();
        bytes = buf.byteLength;
      } else {
        const text = await r.text();
        bytes = text.length;
      }
    } catch (e) {
      return { status: 'fail', code: r.status, statusText: r.statusText, ms, err: `读body失败:${String((e as Error)?.message ?? e)}` };
    }
    return {
      status: r.status >= 200 && r.status < 300 ? 'ok' : 'fail',
      code: r.status,
      statusText: r.statusText,
      ms,
      bytes,
    };
  } catch (e) {
    // fetch 直接抛错(未到 HTTP 层):DNS/SSL/参数等
    return { status: 'fail', ms: Date.now() - t0, err: `fetch异常:${String((e as Error)?.message ?? e).slice(0, 120)}` };
  }
}

export function NetDiagPage({ safeTop, onOffsetChange }: NetDiagPageProps) {
  const [results, setResults] = useState<Record<string, TestState>>({});
  const envInfo = probeEnv();
  const [envVisible, setEnvVisible] = useState(false);

  function handleRunOne(e: { currentTarget: { dataset: Record<string, string> } }) {
    'background only';
    const id = e.currentTarget.dataset.id;
    const t = NET_TESTS.find((x) => x.id === id);
    if (!t) return;
    setResults((prev) => ({ ...prev, [id]: { status: 'running' } }));
    void runTest(t.url, t.method ?? 'GET').then((r) => {
      'background only';
      setResults((prev) => ({ ...prev, [id]: r }));
    });
  }

  function handleRunAll() {
    'background only';
    // 逐个串行,避免并发压测导致超时误判
    void (async () => {
      'background only';
      for (const t of NET_TESTS) {
        setResults((prev) => ({ ...prev, [t.id]: { status: 'running' } }));
        const r = await runTest(t.url, t.method ?? 'GET');
        setResults((prev) => ({ ...prev, [t.id]: r }));
      }
    })();
  }

  function handleToggleEnv() {
    'background only';
    setEnvVisible((v) => !v);
  }

  return (
    <CollapsiblePage title="网络诊断" safeTop={safeTop} onOffsetChange={onOffsetChange}>
      <view className="Group">
        <text className="GroupTitle">环境探测</text>
        <view className="GroupBody">
          <view className="DiagEnvToggle" bindtap={handleToggleEnv}>
            <text className="DiagEnvToggleText">{envVisible ? '收起环境信息 ▲' : '展开环境信息 ▼'}</text>
          </view>
          {envVisible ? (
            <view className="DiagEnvList">
              {envInfo.map((line) => (
                <text key={line} className="DiagEnvLine">{line}</text>
              ))}
            </view>
          ) : (
            <view />
          )}
        </view>
      </view>

      <view className="Group">
        <view className="DiagHeader">
          <text className="GroupTitle">fetch 探测({NET_TESTS.length} 项)</text>
          <view className="DiagRunAllBtn" bindtap={handleRunAll}>
            <text className="DiagRunAllBtnText">全部运行</text>
          </view>
        </view>
        <view className="GroupBody">
          {NET_TESTS.map((t) => {
            const r = results[t.id] ?? { status: 'idle' } as TestState;
            return (
              <view key={t.id}>
                <view className="DiagRow" data-id={t.id} bindtap={handleRunOne}>
                  <view className="DiagRowHead">
                    <text className="DiagName">{t.name}</text>
                    <text className={r.status === 'ok' ? 'DiagBadge ok' : r.status === 'fail' ? 'DiagBadge fail' : 'DiagBadge'}>
                      {r.status === 'idle' ? '点按运行' : r.status === 'running' ? '运行中…' : r.status === 'ok' ? `OK ${r.code}` : `失败 ${r.code ?? ''}`}
                    </text>
                  </view>
                  <text className="DiagNote">{t.note}</text>
                  {r.status === 'ok' || r.status === 'fail' ? (
                    <view className="DiagDetail">
                      <text className="DiagLine">耗时 {r.ms}ms · {r.bytes ?? 0} 字节{r.statusText ? ` · statusText: ${r.statusText}` : ''}</text>
                      {r.err ? <text className="DiagLine err">{r.err}</text> : <view />}
                    </view>
                  ) : (
                    <view />
                  )}
                </view>
              </view>
            );
          })}
        </view>
      </view>

      <view className="Group">
        <text className="GroupTitle">判读说明</text>
        <view className="GroupBody">
          <text className="DiagNote">· 499 = 宿主网络层(Retrofit/OkHttp)把底层异常映射的码,statusText 含原始异常(如 SocketTimeoutException)</text>
          <text className="DiagNote">· 本机中转 OK 而其它全 499 → DNS/出网被劫持;全部 OK → 仅特定域问题</text>
          <text className="DiagNote">· Google 204 预期失败,作为「被墙域名长什么样」的对照样本</text>
          <text className="DiagNote">· fetch 抛异常(无状态码)→ 请求未到达 HTTP 层:URL 解析/SSL/参数问题</text>
        </view>
      </view>
    </CollapsiblePage>
  );
}
