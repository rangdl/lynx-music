/**
 * 给 @lynx-js/web-core 的 client.js 打 class-field 补丁(构建期一次性完成,
 * 运行时 serve.mjs 的同名补丁保留作为兜底 —— 两者幂等,重复打不冲突)。
 *
 * 背景:web-core LynxView 的 `nativeModulesMap;` 是 class field,custom element
 * 升级时构造器会把它重置为 undefined,吞掉宿主脚本升级前的赋值 —— 宿主注册的
 * NativeModules 全体静默消失(songloft-player-lynx 用 pnpm patch 修同一问题)。
 * 这里把字段声明替换成 getter/setter,宿主先行赋值得以保留。
 *
 * 用法:npm run build:web-host(先 rspeedy build,再打补丁)
 * 补丁写入 node_modules/@lynx-js/web-core/dist/client_prod/static/js/client.js,
 * serve.mjs 直接读打过的文件。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, realpathSync } from 'node:fs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function findClientJs() {
  const link = resolve(repoRoot, 'node_modules', '@lynx-js', 'web-core')
  if (!existsSync(link)) return null
  return resolve(realpathSync(link), 'dist', 'client_prod', 'static', 'js', 'client.js')
}

const clientJs = findClientJs()
if (!clientJs || !existsSync(clientJs)) {
  console.error('[patch] 找不到 web-core client.js,请先 npm install')
  process.exit(1)
}

const MARK = '//# patched: nativeModulesMap accessor (see scripts/patch-web-core.mjs)'
let src = readFileSync(clientJs, 'utf-8')

if (src.includes(MARK)) {
  console.log('[patch] 已打过,跳过')
  process.exit(0)
}

const FIELD = 'nativeModulesMap;napiModulesMap;'
if (!src.includes(FIELD)) {
  // 上游版本变了:模式对不上时明确报错而不是静默跳过
  console.error('[patch] 未找到字段声明模式 nativeModulesMap;napiModulesMap; —— web-core 版本可能已变化,请核对源码后更新本脚本')
  process.exit(1)
}

src = src.replace(
  FIELD,
  '#nativeModulesMap;#napiModulesMap;' +
    'get nativeModulesMap(){return this.#nativeModulesMap}' +
    'set nativeModulesMap(v){this.#nativeModulesMap=v}' +
    'get napiModulesMap(){return this.#napiModulesMap}' +
    'set napiModulesMap(v){this.#napiModulesMap=v}' +
    MARK,
)
writeFileSync(clientJs, src)
console.log('[patch] client.js 已打 nativeModulesMap accessor 补丁')
