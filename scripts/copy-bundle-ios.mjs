/**
 * 把构建产物 bundle 拷进 iOS 宿主资源,.app 离线加载(songloft 同款)。
 * Xcode target 的 Resources phase 引用该文件。
 * 用法:node scripts/copy-bundle-ios.mjs(在 npm run build 之后)
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(repoRoot, 'dist', 'main.lynx.bundle')
const DEST = resolve(repoRoot, 'ios', 'LynxMusic', 'main.lynx.bundle')
mkdirSync(dirname(DEST), { recursive: true })
copyFileSync(SRC, DEST)
console.log(`[copy-bundle-ios] ${SRC} -> ${DEST}`)
