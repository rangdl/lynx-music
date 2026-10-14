/* 网络诊断测试清单:数据驱动,NetDiagPage 渲染。
 * 每项一个可独立运行的 fetch 探测;域名覆盖 中国基线/海外/CDN/被墙参照/本机中转。 */

export interface NetTest {
  id: string;
  name: string;
  url: string;
  /** 分组备注 */
  note: string;
  method?: 'GET' | 'POST';
}

export const NET_TESTS: NetTest[] = [
  // —— 基准组:已知可达(判断 fetch 本身是否正常) ——
  { id: 'relay', name: '本机 IPv6 中转(基准)', url: 'http://[240e:343:d10c:aa00::1000]:3089/nianxin.js', note: '电脑直连,验证 fetch 基本功能' },
  { id: 'relay-zip', name: '本机中转 zip(二进制)', url: 'http://[240e:343:d10c:aa00::1000]:3089/pkg.zip', note: '验证 arrayBuffer 二进制读取' },

  // —— fetch 选项对照组:验证 signal/header 等 options 对原生层的影响 ——
  { id: 'relay-signal', name: '中转+AbortSignal 对照', url: 'http://[240e:343:d10c:aa00::1000]:3089/nianxin.js', note: '实测 signal 并非元凶(此项目 OK 200)。保留作回归' },
  { id: 'relay-viahttp', name: '中转·模拟导入链路', url: 'http://[240e:343:d10c:aa00::1000]:3089/nianxin.js', note: '复制 httpRequest 调用形状(Promise+回调+arrayBuffer):OK 则导入 499 另有原因' },

  // —— 国内基线:应全部成功 ——
  { id: 'baidu', name: '百度(国内基线)', url: 'https://www.baidu.com', note: '国内 HTTPS 基线' },
  { id: 'npmmirror', name: 'npmmirror(国内CDN)', url: 'https://registry.npmmirror.com/react', note: '国内 registry JSON' },

  // —— 音源相关 CDN(此前 499 的目标) ——
  { id: 'jsdelivr-fastly', name: 'jsdelivr fastly', url: 'https://fastly.jsdelivr.net/gh/guoyue2010/lxmusic-/V260907/%E5%BF%B5%E5%BF%83%E9%9F%B3%E6%BA%90%20v1.0.2.js', note: '音源脚本所在 CDN' },
  { id: 'jsdelivr-cdn', name: 'jsdelivr cdn', url: 'https://cdn.jsdelivr.net/gh/guoyue2010/lxmusic-/V260907/%E5%BF%B5%E5%BF%83%E9%9F%B3%E6%BA%90%20v1.0.2.js', note: '同上,镜像 2' },
  { id: 'unpkg', name: 'unpkg', url: 'https://unpkg.com/', note: '海外 npm CDN' },

  // —— 海外站点:观察是否整体被墙 ——
  { id: 'github', name: 'GitHub API', url: 'https://api.github.com', note: '海外 API' },
  { id: 'cloudflare', name: 'Cloudflare trace', url: 'https://www.cloudflare.com/cdn-cgi/trace', note: '海外 + 返回出口 IP' },
  { id: 'google', name: 'Google 204(被墙参照)', url: 'http://www.google.com/generate_204', note: '预期失败:确认被墙域名表现' },
];
