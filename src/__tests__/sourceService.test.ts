/* SourceService 集成测试:真实脚本代码 + 假网络,验证 安装→注册表→取链 全链路。 */

import { describe, expect, test, beforeEach } from '@rstest/core';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// 隔离 localStorage 依赖:platform 的 web storage 在 rstest(jsdom)下可用,直接用

import { SourceService } from '../services/source/sourceService.js';

/* 假网络:脚本 init 检查更新的请求返回"已是最新",取链 URL 返回媒体地址 */
function fakeRequestFor(updateHost: RegExp, urlBody: string) {
  return (url: string, _opts: Record<string, unknown>, cb: (e: Error | null, r: { statusCode: number; headers: Record<string, string>; body: unknown } | null) => void) => {
    setTimeout(() => {
      if (updateHost.test(url)) {
        cb(null, { statusCode: 200, headers: {}, body: { code: 200, data: { version: '0', init: { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } } } } });
      } else {
        cb(null, { statusCode: 200, headers: {}, body: urlBody });
      }
    }, 5);
  };
}

describe.sequential('SourceService 集成(假脚本)', () => {
  beforeEach(() => { localStorage.clear(); });

  test('install → listScripts → resolve 全链路', async () => {
    const goodScript = `
      let { EVENT_NAMES, request, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, ({ source, info }) => {
        return new Promise((resolve) => {
          request('https://fake.test/url?mid=' + info.musicInfo.songmid, {}, (err, resp) => resolve(resp.body));
        });
      });
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k','320k'] } } });
    `;
    const svc = new SourceServiceWithNet(fakeRequestFor(/update/, 'https://media.test/song.mp3'));
    const entry = await svc.install(goodScript);
    expect(entry.name).toBe('未命名脚本');
    expect(Object.keys(entry.sources)).toEqual(['kw']);

    const list = await svc.listScripts();
    expect(list).toHaveLength(1);
    expect(list[0].enabled).toBe(true);

    const result = await svc.resolve({ songmid: '12345', source: 'kw', quality: '128k' });
    expect(result.url).toBe('https://media.test/song.mp3');
    expect(result.source).toBe('kw');
  });

  test('脚本失败时换下一个脚本', async () => {
    const failScript = `
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => { throw new Error('boom'); });
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });
    `;
    const goodScript = `
      let { EVENT_NAMES, request, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, ({ info }) => new Promise((r) => request('https://fake.test/url?mid=' + info.musicInfo.songmid, {}, (e, resp) => r(resp.body))));
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });
    `;
    const svc = new SourceServiceWithNet(fakeRequestFor(/update/, 'https://media.test/fallback.mp3'));
    await svc.install(failScript);
    await svc.install(goodScript + ' '); // 尾部空格区分 id
    const result = await svc.resolve({ songmid: '1', source: 'kw', quality: '128k' });
    expect(result.url).toBe('https://media.test/fallback.mp3');
  });

  test('负缓存:失败后 30s 内直接拒绝', async () => {
    const failScript = `
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => { throw new Error('boom'); });
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });
    `;
    const svc = new SourceServiceWithNet(fakeRequestFor(/update/, 'x'));
    await svc.install(failScript + Date.now());
    await expect(svc.resolve({ songmid: '9', source: 'kw', quality: '128k' })).rejects.toThrow();
    // 第二次应在负缓存窗口内(错误信息含"冷却")
    await expect(svc.resolve({ songmid: '9', source: 'kw', quality: '128k' })).rejects.toThrow('冷却');
  });
});

/* 测试辅助:注入假网络与真实 md5 的 SourceService。
 * SourceService 构造函数目前固定用 platform/http;为了让测试可控,
 * 这里用子类覆盖 bridge(仅测试用,不违反分层——测试文件允许触及实现)。 */
import { SourceBridge } from '../runtime/bridge.js';
import type { RequestFn } from '../runtime/api/lxApi.js';

class SourceServiceWithNet extends SourceService {
  constructor(request: RequestFn) {
    super((url, cb) => request(url, {}, cb));
    // 覆盖私有 bridge:测试专用(同网络 + 真实 md5)
    (this as unknown as { bridge: SourceBridge }).bridge = new SourceBridge({
      request,
      crypto: { md5: (s: string, t?: string) => createHash('md5').update(s).digest((t ?? 'hex') as 'hex') },
    });
  }
}

describe.sequential('SourceService 集成(真实念心脚本,离线 mock)', () => {
  beforeEach(async () => { await new SourceServiceWithNet((u, o, cb) => cb(null, null)).clearAll(); });

  test('真实脚本可安装且解析出元数据', async () => {
    const code = readFileSync('/data/workspace/lynx/test-fixtures/nianxin.js', 'utf8');
    // 念心 init:检查更新 URL 返回"已是最新",随后 send(inited) 由脚本自行构造
    const svc = new SourceServiceWithNet((url, _o, cb) => {
      setTimeout(() => cb(null, { statusCode: 200, headers: {}, body: { code: 200, data: { version: '0', update: { version: '0' } } } }), 5);
    });
    const entry = await svc.install(code);
    expect(entry.name).toBe('念心音源');
    expect(entry.version).toBe('1.0.2');
    expect(Object.keys(entry.sources).sort()).toEqual(['kg', 'kw', 'mg', 'tx', 'wy']);
  });
});

describe.sequential('installFromUrl(URL 导入)', () => {
  beforeEach(async () => { await new SourceServiceWithNet((u, o, cb) => cb(null, null)).clearAll(); });

  function netWithBytes(body: Uint8Array | string) {
    return (url: string, _o: Record<string, unknown>, cb: (e: Error | null, r: { statusCode: number; headers: Record<string, string>; body: unknown } | null) => void) => {
      setTimeout(() => cb(null, { statusCode: 200, headers: {}, body }), 5);
    };
  }

  test('单脚本 URL:下载文本并安装', async () => {
    const script = `
      let { EVENT_NAMES, on, send } = globalThis.lx;
      on(EVENT_NAMES.request, () => 'https://u.test/a.mp3');
      send(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });
    `;
    const svc = new SourceServiceWithNet(netWithBytes(script));
    const { installed, errors } = await svc.installFromUrl('https://cdn.test/source.js');
    expect(errors).toHaveLength(0);
    expect(installed).toHaveLength(1);
    expect((await svc.listScripts())).toHaveLength(1);
  });

  test('zip URL:解包安装全部 .js,跳过其它文件', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const mk = (name: string) => `/**\n * @name ${name}\n * @version 1\n */\nlet { EVENT_NAMES, on, send } = globalThis.lx;\non(EVENT_NAMES.request, () => 'https://z.test/a.mp3');\nsend(EVENT_NAMES.inited, { status: true, sources: { kw: { type: 'music', name: 'kw', actions: ['musicUrl'], qualitys: ['128k'] } } });`;
    const zip = zipSync({
      'pkg/a.js': strToU8(mk('压缩音源A')),
      'pkg/b.js': strToU8(mk('压缩音源B')),
      'pkg/readme.md': strToU8('not js'),
    });
    const svc = new SourceServiceWithNet(netWithBytes(new Uint8Array(zip)));
    const { installed, errors } = await svc.installFromUrl('https://cdn.test/pkg.zip');
    expect(errors).toHaveLength(0);
    expect(installed.map((s) => s.name).sort()).toEqual(['压缩音源A', '压缩音源B']);
    expect((await svc.listScripts())).toHaveLength(2);
  });

  test('坏 zip 报可读错误', async () => {
    const svc = new SourceServiceWithNet(netWithBytes(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5, 6])));
    await expect(svc.installFromUrl('https://cdn.test/bad.zip')).rejects.toThrow('解压失败');
  });
});
