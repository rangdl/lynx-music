/**
 * Web 预览开发服务器(套用 songloft-player-lynx 的宿主底座方案)。
 *
 * 提供:
 *  - / ……………………………… web/index.html(自托管入口页,含宿主脚本)
 *  - /main.lynx.bundle … dist/main.web.bundle(注意:本项目 rspeedy web 目标产物名)
 *  - /audio-host.js ……… web/ 目录宿主脚本
 *  - /web-core/static/* …… @lynx-js/web-core client_prod 资产
 *
 * 用法:
 *   1. npm run build
 *   2. node web/serve.mjs
 *   3. 打开 http://localhost:3091
 *
 * COOP/COEP 头是 web-core WASM 引擎 SharedArrayBuffer 的要求。
 */

import { createServer } from 'node:http'
import { readFileSync, statSync, existsSync, realpathSync } from 'node:fs'
import { extname, resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const PORT = process.env.PORT ?? 3091

// rspeedy web 环境产物(dist/main.web.bundle),对外统一叫 main.lynx.bundle,
// 与 index.html 的 <lynx-view url> 和 songloft 的布局保持一致。
const BUNDLE_PATH = resolve(repoRoot, 'dist', 'main.web.bundle')

function findWebCorePath() {
  const link = resolve(repoRoot, 'node_modules', '@lynx-js', 'web-core')
  if (!existsSync(link)) return null
  const staticDir = resolve(realpathSync(link), 'dist', 'client_prod', 'static')
  return existsSync(staticDir) ? staticDir : null
}

const WEB_CORE_PATH = findWebCorePath()
if (!WEB_CORE_PATH) {
  console.error('[serve] 找不到 @lynx-js/web-core 资产,请先 npm install')
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function serveFile(res, filePath) {
  try {
    const body = readFileSync(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-cache',
    })
    res.end(body)
    return true
  } catch {
    return false
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  console.log('[req]', pathname)
  if (pathname === '/') pathname = '/index.html'

  // 路由白名单,防目录穿越
  if (pathname === '/main.lynx.bundle') {
    if (serveFile(res, BUNDLE_PATH)) return
    res.writeHead(404).end('bundle not built; run npm run build')
    return
  }
  // web-core class-field 补丁(套用 songloft 的 @lynx-js/web-core patch):
  // LynxView 的 `nativeModulesMap;` 是 class field,custom element 升级时构造器
  // 会把它重置为 undefined,吞掉宿主脚本升级前的赋值 —— 宿主注册的模块全体
  // 静默消失。改成 getter/setter 存到私有字段,宿主先行赋值得以保留。
  if (pathname === '/web-core/static/js/client.js') {
    try {
      let src = readFileSync(join(WEB_CORE_PATH, 'js/client.js'), 'utf-8')
      const FIELD = 'nativeModulesMap;napiModulesMap;'
      if (src.includes(FIELD)) {
        src = src.replace(FIELD, '#nativeModulesMap;#napiModulesMap;' +
          'get nativeModulesMap(){return this.#nativeModulesMap}' +
          'set nativeModulesMap(v){this.#nativeModulesMap=v}' +
          'get napiModulesMap(){return this.#napiModulesMap}' +
          'set napiModulesMap(v){this.#napiModulesMap=v}')
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cache-Control': 'no-cache',
        })
        res.end(src)
        return
      }
    } catch { /* 落到常规服务 */ }
  }

  if (pathname.startsWith('/web-core/static/')) {
    const rel = pathname.slice('/web-core/static/'.length)
    const filePath = join(WEB_CORE_PATH, rel)
    if (!filePath.startsWith(WEB_CORE_PATH)) { res.writeHead(403).end(); return }
    if (serveFile(res, filePath)) return
  }
  // 宿主脚本与页面本体(web/ 目录)
  const hostFile = resolve(__dirname, '.' + pathname)
  if (hostFile.startsWith(__dirname) && serveFile(res, hostFile)) return

  res.writeHead(404).end('not found')
}).listen(PORT, () => {
  console.log(`[serve] Web 预览: http://localhost:${PORT}`)
})
