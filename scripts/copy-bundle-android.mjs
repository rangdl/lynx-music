/**
 * 把构建产物 bundle 拷进 Android 宿主 assets,APK 离线加载(songloft 同款)。
 * 用法:node scripts/copy-bundle-android.mjs(在 npm run build 之后)
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(repoRoot, 'dist', 'main.lynx.bundle')
const DEST = resolve(repoRoot, 'android', 'app', 'src', 'main', 'assets', 'main.lynx.bundle')
mkdirSync(dirname(DEST), { recursive: true })
copyFileSync(SRC, DEST)
console.log(`[copy-bundle-android] ${SRC} -> ${DEST}`)
