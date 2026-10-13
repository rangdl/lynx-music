# 架构设计 —— Lynx 音乐播放器(承接 lx-runner 音源)

> 目标:用 Lynx + ReactLynx 构建跨端(iOS/Android/Web)音乐播放器,核心能力是运行
> **lx 音源脚本**(用户自定义 JS,从各平台取播放链接),并管理本地/媒体服务器音乐库。
> 本文档是目标架构,不以当前原型代码为约束;原型中已验证的结论(主题、双线程坑)会吸收进来。

## 0. 设计原则

1. **分层单向依赖**:`platform → runtime → services → state → ui`,每层只能调用下层,禁止反向。UI 不直接碰 `fetch`/脚本/存储。
2. **UI 纯渲染**:组件无业务逻辑,状态来自 store(hooks 注入),事件回调向上抛。当前 `App.tsx` 已经是这个形态,保持并下沉。
3. **一切外部能力走接口**:网络、存储、音频播放、系统信息全部收敛到 `src/platform/` 的适配层,通过 `lynx.__globalProps` / `NativeModules` 探测宿主能力并给出 Web 回退。这是"开源 Web 可跑、真机全功能"的关键。
4. **可测性**:services/runtime 层不依赖 Lynx 渲染 API,可在 Rstest + jsdom 下直接单测。

## 1. 目录结构(目标)

```
src/
├── index.tsx              # 入口:root.render(<App/>),只做装配
├── App.tsx                # 组合层:Provider 栈 + 路由壳(不写业务状态)
├── ui/                    # 纯 UI 层(无 import services)
│   ├── components/        # 通用组件:Icon、NavBar、SwitchRow、MiniPlayer…
│   ├── pages/             # 页面:Library / Explore / Playing / Settings / SourceManage
│   └── theme/             # useTheme、tokens(语义色)、ThemeProvider
├── state/                 # 状态层(Zustand,见 §4)
│   ├── playerStore.ts
│   ├── libraryStore.ts
│   ├── sourceStore.ts
│   └── settingsStore.ts
├── services/              # 业务服务层(后台线程逻辑,均可单测)
│   ├── player/            # 播放控制:队列、顺序、断点、与 platform/audio 对接
│   ├── library/           # 音乐库:本地扫描、Plex/Emby/Navidrome 同步、去重排序
│   ├── source/            # 音源编排:脚本加载、缓存、选择策略、失败降级
│   └── metadata/          # 歌词/封面 API 聚合
├── runtime/               # lx 脚本运行时(见 §3)
│   ├── sandbox.ts
│   ├── bridge.ts
│   ├── api/               # 暴露给脚本的 lx API:fetch/加密/zlib…
│   └── types.ts
├── platform/              # 平台适配层(见 §2)
│   ├── index.ts           # 能力探测与单例导出
│   ├── http.ts            # fetch 封装(超时/重试/UA/流式)
│   ├── storage.ts         # lynx storage → localStorage 回退
│   ├── audio.ts           # NativeModules.Audio → Web <audio> 回退
│   └── system.ts          # 安全区、主题、退出等宿主信息
├── data/                  # 纯静态数据/类型(歌单 mock、设置 schema)
└── __tests__/
```

## 2. 平台适配层(platform/)

**唯一允许出现 `NativeModules`、`lynx.__globalProps`、`window` 探测的地方。**

```ts
// platform/index.ts
export const capabilities = {
  audio: !!NM?.Audio,        // 真机原生播放器
  storage: !!lynx.getJSModule, ...
  theme: globalProps?.appTheme,
};
export const http    = capabilities.audio ? nativeHttp : webHttp;
export const audio   = capabilities.audio ? nativeAudio : webAudio;
```

- 每个适配文件导出**同名接口**,真机实现与 Web 实现二选一,其余代码只 import 接口。
- 安全区、主题跟随(宿主 `setTheme` → `globalProps.appTheme` + `GlobalEventEmitter` 通知)在这里完成,当前 `App.tsx` 里的 `readSafeTop()` 迁入 `platform/system.ts`。
- fetch 注意:PrimJS 无 `TextEncoder/TextDecoder`,统一走 `TextCodecHelper` 封装在 `http.ts` 内,禁止散落使用。

## 2.1 存储决策:KV 现做,SQLite 延后

Lynx 引擎**没有内置 storage API**(官方 storage 文档为空),持久化属于宿主能力,官方唯一示例是 Native Module 封装平台 KV(iOS NSUserDefaults / Android SharedPreferences / HarmonyOS Preferences)。SQLite 同样只能走自写 Native Module(各平台 SQLite 封装)或 Android WASM 方案(sql.js,不推荐做主存储)。

因此双轨:

- **现在**:`platform/storage.ts` 只做 KV 接口。真机走 `NativeModules` KV 模块(照官方示例),Web 走 localStorage。服务对象:设置项、音源脚本注册表、播放断点。
- **触发条件后再上 SQLite**(`platform/db.ts`,预留位置):音乐库超过 ~1 万条、或需要多条件筛选/全文搜索时,实现 `NativeModules.LxDbModule`(iOS libsqlite3 / Android SQLiteDatabase / HarmonyOS relationalStore)。
- 注意:SharedPreferences/NSUserDefaults 存大 JSON 有性能问题,音乐库全量塞 KV 不是长久之计——这是预留 `db.ts` 的原因。

## 3. lx 音源运行时(runtime/)—— 本项目核心

lx 音源脚本是一个**调用 `globalThis.lx` API、导出 `musicSources` 对象**的用户 JS 字符串。它不可信、可能死循环、可能打大量请求,因此:

```
┌────────────── ui(SourceManage) ──────────────┐
│  添加/启停/排序/测试脚本                        │
└──────────────────┬───────────────────────────┘
                   ↓ state(sourceStore)
┌──────────── services/source ─────────────────┐
│  脚本注册表(持久化) · 取链编排:                 │
│  按音源优先级逐个尝试 → 30s 负缓存 → 换源重试    │
└──────┬─────────────────────────┬─────────────┘
       ↓                         ↓
┌─ runtime/bridge ──────┐  ┌─ runtime/sandbox ─┐
│ getMusicUrl(source,   │  │ new Function 或   │
│  song, quality)       │→ │ worker 化执行用户  │
│ Promise + 超时 + 取消  │  │ 脚本;注入 lx API  │
└───────────────────────┘  └───────────────────┘
```

要点:

- **沙箱隔离**:用户脚本通过 `sandbox.ts` 求值,注入受控的 `lx` 对象(`on('request')` 事件回调、`fetch`、`crypto`、`zlib` 封装),**不暴露真实 `NativeModules`、storage、DOM**。脚本内所有网络请求经 `runtime/api/http.ts` 走我们的 `platform/http`(才能统一超时、日志与限额)。
- **桥接协议**:`bridge.ts` 对上层暴露纯 Promise API:
  ```ts
  getMusicUrl(sourceId: string, song: SongRef, quality: Quality): Promise<UrlResult>
  ```
  内部做超时(单源 10s)、取消(AbortSignal)、错误分类(脚本崩溃 / 全源失败 / 需登录)。**services/player 永远不知道脚本存在。**
- **脚本生命周期**:安装时静态校验(能 eval、有 `musicSources`、来源/名称/版本元数据)→ 健康检查(拿一首测试歌的链接)→ 启用入注册表。脚本文件本身存 storage(`platform/storage`),注册表含校验和,损坏可检测。
- **可测**:`bridge.ts` + 假脚本 + 假 http 即可全链路单测,不依赖真机。

## 4. 状态层(state/)—— Zustand + TanStack Query 分工

本地 UI 状态选 **Zustand**(官方推荐之一:体积小、无 Provider 嵌套、selector 订阅避免双线程下多余重渲染);**服务端数据(音乐库同步、歌词/封面)用 TanStack Query**(官方 data-fetching 推荐,天然带缓存/重试/失效),手写缓存只在 lx 脚本取链处(多源降级编排不是典型 query,见 §3)。

官方推荐三大方案中选 **Zustand**(体积小、无 Provider 嵌套、selector 订阅避免双线程下多余重渲染;Jotai/Valtio 备选但无必要)。

```ts
// state/playerStore.ts —— 示例形态
export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [], current: null, playing: false, quality: '320k',
  // actions 内部调 services,组件只 dispatch
  play: (id) => { set({current:id}); services.player.play(id); },
}));
```

- **store 只存可序列化状态**,音频句柄、脚本实例等重资源放在 services 的模块级单例里,store 存 id。
- 页面/组件用 selector 订阅(`usePlayerStore(s => s.playing)`),禁止整 store 订阅——Lynx 双线程下多余 re-render 的代价高于 Web。
- 持久化(settings、注册表、播放断点)由各 store 显式 `persist` 到 `platform/storage`,不要全局自动持久化。

## 5. 播放链路(end-to-end)

```
用户点歌 → playerStore.play(id)
  → services/player:
      1. 本地文件? → platform/audio.play(fileUrl)
      2. 媒体服务器直链? → 直接播
      3. 需要音源 → services/source.resolve(song, quality)
           → runtime/bridge → [脚本A, B, C…] 按序取链
  → platform/audio.play(url) → 状态回写 store(进度/缓冲/错误)
  → 失败:toast + 自动试下一音源/降音质
```

- `platform/audio` 接口:`play/pause/seek/setRate/setVolume/事件(position、ended、error)`。Web 回退用 `<audio>`(仅 Web 环境存在,合法)。
- 进度条这类高频 UI:后台线程 state 每秒 1 次足够;若做拖动手势跟手,再上 `main-thread:` 事件 + `MainThread.Element.setStyleProperty`,不要默认用。

## 6. 主题与样式

已实测定案(勿走回头路,详见 `src/theme/` 头注释):

- **主题 = JS 单一状态**(`useTheme`),根节点挂 `.theme-light/.theme-dark` 类;CSS 变量随类切换。
- **不用** `@media (prefers-color-scheme)`(Web 预览构建期剥离)、**不用** SVG 属性里的 `var()`(x-svg 的 `<img>` 化解析不到)、后台线程无 `matchMedia`。
- 图标经 `ui/components/Icon` 按主题解析具体色值。未来接原生壳后由 `platform/system` 监听宿主主题事件恢复"跟随系统"。
- 色板 token 三处一致:`App.css` 的 `--*` 变量、`useTheme.ts` 的 TONES、settings 数据里的 iconColor——收敛到 `ui/theme/tokens.ts` 单一来源,CSS 与 JS 都从这里生成/引用。

## 7. 路由与页面

- 页面数增多后引入 **React Router v6**(官方支持,Memory 模式)。官方限制(务必遵守):ReactLynx 只支持 React 17 API,**必须装 `react-router@6`**;**没有 `<Link>`/`<NavLink>`**,导航只能用 `useNavigate`。
- 通用 UI 组件**优先用 `@lynx-js/lynx-ui`**(项目已装:Switch、Input、Dialog、Sheet、Swiper、List 等),自绘组件仅当 lynx-ui 不满足或风格冲突时使用。
- 现有两 Tab(音乐库/设置)保留,新增:播放页(全屏)、音源管理、歌词/封面 API 配置。
- 路由层放在 `App.tsx` 之下第一层,`SafeAreaProvider`/`ThemeProvider` 在其外。

## 8. 构建与质量门

- Rspeedy(现状)+ `pluginLynxConfig({ enableCSSRule: true })`;`npm run test`(Rstest + @lynx-js/react testing-library)。
- 测试分层目标:runtime/bridge 与 services 全覆盖(纯 TS,快);ui 组件冒烟(render + 关键交互);平台适配层真机手工清单。
- CI(后续):`type-check + test + build` 三命令即门禁。

## 9. 迁移顺序(从当前原型)

1. 目录平移:`components/pages → ui/`,`useTheme/theme → ui/theme/`(行为不变,先立骨架)。
2. 引入 Zustand,把 `App.tsx` 的 8 个 useState 拆进 player/settings store。
3. 建 `platform/`,迁入 `readSafeTop`、storage、http 封装。
4. 建 `runtime/`(sandbox + bridge + 假脚本测试),再建 `services/source`。
5. 接 React Router,加音源管理页与播放页;`services/player` 接 `platform/audio`。
6. 媒体服务器(Plex/Emby/Navidrome)同步放最后——依赖面最大。
