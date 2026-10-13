/* runtime + services/source 全链路单测:假脚本 + 假网络,不依赖真机。 */

import { describe, expect, test, beforeEach } from '@rstest/core';

import { loadScript } from '../runtime/sandbox.js';
import { SourceBridge } from '../runtime/bridge.js';
import { parseScriptMeta } from '../services/source/sourceService.js';
import type { RequestFn } from '../runtime/api/lxApi.js';

/* ---------- 测试用假网络 ---------- */

const fakeNet: Record<string, unknown> = {
  'https://ok.test/init': { code: 200 },
  'https://ok.test/url': 'https://media.example/song.mp3',
};

function makeFakeRequest(override: Record<string, unknown> = {}): RequestFn {
  const table = { ...fakeNet, ...override };
  return (url, _opts, cb) => {
    setTimeout(() => {
      // 前缀匹配:脚本可能在 url 上追加 query
      const key = Object.keys(table).find((k) => url === k || url.startsWith(k + '?') || url.startsWith(k + '/'));
      const body = key === undefined ? undefined : table[key];
      if (body === undefined) return cb(new Error(`404: ${url}`), null);
      cb(null, { statusCode: 200, headers: {}, body });
    }, 5);
  };
}

/* ---------- 最小可用假脚本(遵循实测协议) ---------- */

const GOOD_SCRIPT = `
let { EVENT_NAMES, request, on, send } = globalThis.lx;
on(EVENT_NAMES.request, ({ source, info }) => {
  return new Promise((resolve, reject) => {
    request('https://ok.test/url?src=' + source + '&mid=' + info.musicInfo.songmid, {}, (err, resp) => {
      if (err) return reject(err);
      resolve(resp.body);
    });
  });
});
send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k','320k'] } } });
`;

const BAD_SCRIPT = `
let { EVENT_NAMES, on, send } = globalThis.lx;
on(EVENT_NAMES.request, () => { throw new Error('boom'); });
send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });
`;

const NEVER_INIT_SCRIPT = `let { on } = globalThis.lx; on('request', () => {});`;

/* ---------- sandbox ---------- */

describe('sandbox', () => {
  test('加载合规脚本并收到 inited 能力声明', async () => {
    const inst = await loadScript({
      scriptName: 't', scriptVersion: '1', code: GOOD_SCRIPT,
      request: makeFakeRequest(), initTimeoutMs: 2000,
    });
    expect(Object.keys(inst.sources)).toEqual(['kw']);
    expect(inst.sources.kw.qualitys).toEqual(['128k', '320k']);
  });

  test('沙箱隔离:脚本访问不到全局白名单外的对象', async () => {
    const spyScript = `
      let leaked = [];
      try { leaked.push(typeof window); } catch (e) { leaked.push('E'); }
      try { leaked.push(typeof document); } catch (e) { leaked.push('E'); }
      try { leaked.push(typeof NativeModules); } catch (e) { leaked.push('E'); }
      leaked.push(typeof globalThis.lx);
      globalThis.__probe = leaked;
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => { return globalThis.__probe.join(','); });
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type:'music', name:'kw', actions:['musicUrl'], qualitys:['128k'] } } });
    `;
    const inst = await loadScript({
      scriptName: 't', scriptVersion: '1', code: spyScript,
      request: makeFakeRequest(), initTimeoutMs: 2000,
    });
    const result = await inst.musicUrl({ source: 'kw', action: 'musicUrl', info: { musicInfo: { songmid: '1' }, type: '128k' } });
    // window/document/NativeModules 取不到(白名单 Proxy 返回 undefined),lx 可见
    expect(result).toBe('undefined,undefined,undefined,object');
  });

  test('永不 inited 的脚本超时拒绝', async () => {
    await expect(loadScript({
      scriptName: 't', scriptVersion: '1', code: NEVER_INIT_SCRIPT,
      request: makeFakeRequest(), initTimeoutMs: 100,
    })).rejects.toThrow('初始化超时');
  });

  test('取链成功返回 url', async () => {
    const inst = await loadScript({
      scriptName: 't', scriptVersion: '1', code: GOOD_SCRIPT,
      request: makeFakeRequest(), initTimeoutMs: 2000,
    });
    const url = await inst.musicUrl({ source: 'kw', action: 'musicUrl', info: { musicInfo: { songmid: '42' }, type: '128k' } });
    expect(url).toBe('https://media.example/song.mp3');
  });

  test('取链超时被 race 掐断', async () => {
    const slowScript = `
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => new Promise(() => {}));
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type:'music', name:'kw', actions:['musicUrl'], qualitys:['128k'] } } });
    `;
    const inst = await loadScript({
      scriptName: 't', scriptVersion: '1', code: slowScript,
      request: makeFakeRequest(), initTimeoutMs: 2000,
    });
    await expect(inst.musicUrl({ source: 'kw', action: 'musicUrl', info: { musicInfo: { songmid: '1' }, type: '128k' } }, 80))
      .rejects.toThrow('取链超时');
  });
});

/* ---------- bridge ---------- */

describe('bridge', () => {
  test('非法 url 被拒绝并包装为 ScriptError', async () => {
    const badUrlScript = `
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => 'not-a-url');
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type:'music', name:'kw', actions:['musicUrl'], qualitys:['128k'] } } });
    `;
    const bridge = new SourceBridge({ request: makeFakeRequest() });
    await bridge.load('id1', 'bad', '1', badUrlScript);
    await expect(bridge.musicUrl('id1', { source: 'kw', action: 'musicUrl', info: { musicInfo: { songmid: '1' }, type: '128k' } }))
      .rejects.toThrow('非法 url');
  });
});

/* ---------- 元数据解析 ---------- */

describe('parseScriptMeta', () => {
  test('解析头部注释 @name/@version/@author', () => {
    const meta = parseScriptMeta('/**\n * @name 聚合API\n * @version 3\n * @author lerd\n */\nlet x=1;');
    expect(meta).toEqual({ name: '聚合API', version: '3', author: 'lerd' });
  });
  test('缺省元数据给占位值', () => {
    const meta = parseScriptMeta('let x = 1;');
    expect(meta.name).toBe('未命名脚本');
  });
});
