import Foundation

/**
 * Lynx 原生模块 `NativeModules.LynxAudio` —— iOS 音频后端(AVPlayer,经
 * [LynxAudioEngine])。Web 侧对应 web/audio-host.js;协议与 platform/audio.ts
 * 逐字节一致:load/play/pause/stop/seek/setVolume/setSpeed/dispose,
 * 事件经 LynxContext.sendGlobalEvent 回 BTS GlobalEventEmitter。
 *
 * iOS 无 @LynxMethod 注解:methodLookup 缺条目的方法在 JS 对象上直接不存在
 * (songloft 实测:isNativeAudioAvailable 会整个拒绝模块,静默落到 stub,
 * 音频"可用"但永远不响)。与 platform/audio.ts 的 REQUIRED 列表保持同步。
 */
final class LynxAudioModule: NSObject, LynxContextModule {
  /// 必须与 TS facade 探测的键一致(NativeModules.LynxAudio)。
  @objc static var name: String { "LynxAudio" }

  @objc static var methodLookup: [String: String] {
    [
      "load": NSStringFromSelector(#selector(LynxAudioModule.load(_:))),
      "play": NSStringFromSelector(#selector(LynxAudioModule.play)),
      "pause": NSStringFromSelector(#selector(LynxAudioModule.pause)),
      "stop": NSStringFromSelector(#selector(LynxAudioModule.stop)),
      "seek": NSStringFromSelector(#selector(LynxAudioModule.seek(_:))),
      "setVolume": NSStringFromSelector(#selector(LynxAudioModule.setVolume(_:))),
      "setSpeed": NSStringFromSelector(#selector(LynxAudioModule.setSpeed(_:))),
      "dispose": NSStringFromSelector(#selector(LynxAudioModule.dispose)),
    ]
  }

  /// weak:context 由创建本模块的 LynxView 持有,强引用会经 JS 运行时成环。
  private weak var context: LynxContext?

  private init(context: LynxContext?) {
    self.context = context
    super.init()
    // 赋值(而非 add)与 Kotlin sink 语义一致:最新实例独占投递,页面重载
    // 不会收到旧 context 的事件。
    LynxAudioEngine.shared.sink = { [weak self] event, payload in
      // sendGlobalEvent(name, [payload]):数组首元素即监听器的第一个实参 ——
      // 与 web/audio-host.js 的 sendGlobalEvent 数组约定一致。
      self?.context?.sendGlobalEvent(event, withParams: [payload])
    }
  }

  /// 运行时对 LynxContextModule 实际调用的构造器。签名必须与协议完全一致。
  @objc(initWithLynxContext:)
  convenience init(lynxContext context: LynxContext) {
    self.init(context: context)
  }

  /// 以下三个只为满足协议:Swift 无法表达 ObjC @optional 构造器要求,
  /// 声明了自己的 init 后就要求全部补齐(songloft 同款)。
  @objc(initWithLynxContext:WithParam:)
  convenience init(lynxContext context: LynxContext, withParam param: Any) {
    self.init(context: context)
  }

  @objc(initWithParam:)
  convenience init(param: Any) {
    self.init(context: nil)
  }

  override convenience init() {
    self.init(context: nil)
  }

  // MARK: - 源与传输

  @objc func load(_ url: String) {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.load(url: url) }
  }

  @objc func play() {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.play() }
  }

  @objc func pause() {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.pause() }
  }

  @objc func stop() {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.stop() }
  }

  @objc func seek(_ positionMs: Double) {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.seek(positionMs: positionMs) }
  }

  @objc func setVolume(_ volume: Double) {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.setVolume(Float(volume)) }
  }

  @objc func setSpeed(_ rate: Double) {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.setSpeed(Float(rate)) }
  }

  // MARK: - 生命周期

  @objc func dispose() {
    let engine = LynxAudioEngine.shared
    engine.runOnMain { engine.release() }
  }
}
