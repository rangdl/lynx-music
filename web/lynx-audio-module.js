/**
 * `NativeModules.LynxAudio` 的 Web 实现(worker 侧)。
 *
 * web-core 把 nativeModulesMap 里的 ESM URL 交给 worker import(),默认导出是
 * 工厂 `(nativeModules, call) => module`。方法 fire-and-forget,经 `call` 转到
 * 主线程 `lynxView.onNativeModulesCall(name, data, 'LynxAudio')`(audio-host.js)。
 *
 * 播放事件(stateChanged/progress/error)不走这条通道 —— audio-host.js 用
 * `lynxView.sendGlobalEvent` 走 GlobalEventEmitter 回 worker(worker 侧
 * `lynx.getJSModule('GlobalEventEmitter').addListener` 订阅)。
 */

var METHODS = ['load', 'play', 'pause', 'stop', 'seek', 'setVolume', 'setSpeed', 'dispose']

export default function (_nativeModules, call) {
  var module = {}
  for (var i = 0; i < METHODS.length; i++) {
    ;(function (name) {
      module[name] = function () {
        // 位置参数原样转发:load(url) / seek(ms) 等
        void call(name, Array.prototype.slice.call(arguments))
      }
    })(METHODS[i])
  }
  return module
}
