import AVFoundation
import MediaPlayer

/**
 * 进程级音频引擎,支撑 [LynxAudioModule](iOS 音频后端,AVPlayer)。
 * 照 songloft SongloftAudioEngine 精简:去掉 EQ、视频输出、歌词通知、封面下载、
 * 断点续播队列 —— 保留 load/play/pause/stop/seek/volume/speed + 事件回传 +
 * 锁屏遥控(后台播放必需)。
 *
 * 事件载荷与 Web audio-host.js、platform/audio.ts 的协议逐字节一致:
 *   stateChanged: { state: idle|loading|ready|playing|paused|completed|error }
 *   progress:     { positionMs, durationMs }
 *   error:        { code, message }
 * AVPlayer 与其 KVO/通知回调是主线程亲和的,而 Lynx @objc 方法调用来自 BTS
 * 线程 —— 所有入口经 runOnMain 汇聚(songloft 同款规则)。
 */
final class LynxAudioEngine {
  static let shared = LynxAudioEngine()

  /// 事件名必须与 platform/audio.ts 的 EVT 逐字节一致。
  static let eventStateChanged = "LynxAudio.stateChanged"
  static let eventProgress = "LynxAudio.progress"
  static let eventError = "LynxAudio.error"

  /// songloft 实测:0.5s 墙钟节奏。
  private static let progressIntervalSeconds = 0.5

  /// 由 module 安装;转发事件到 LynxContext.sendGlobalEvent。
  var sink: ((String, [String: Any]) -> Void)?

  private var player: AVPlayer?
  private var timeObserver: Any?
  private var itemStatusObservation: NSKeyValueObservation?
  private var timeControlObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?
  private var loadGeneration = 0
  private var preparingAsset: AVURLAsset?
  private var speed: Float = 1.0
  /// 当前曲已自然播完 —— 防止随后的 rate→0 触发多余的 paused(盖掉 completed)。
  private var reachedEnd = false
  /// 当前 item 已致命失败;失败后 AVPlayer 仍会发 timeControlStatus 转移,
  /// 会覆盖 JS 侧刚写下的 error 态,需抑制。
  private var itemFailed = false

  private init() {}

  func runOnMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread { block() } else { DispatchQueue.main.async(execute: block) }
  }

  // MARK: - 源与传输(主线程)

  func load(url: String) {
    activateSession()
    installRemoteCommands()
    let player = ensurePlayer()
    invalidatePreparation()
    let generation = loadGeneration
    itemStatusObservation = nil
    player.pause()
    player.replaceCurrentItem(with: nil)
    reachedEnd = false
    itemFailed = false
    emitState("loading")

    guard let assetURL = URL(string: url) else {
      itemFailed = true
      emit(Self.eventError, ["code": "ERROR_INVALID_URL", "message": "invalid media url"])
      emitState("error")
      return
    }
    let asset = AVURLAsset(url: assetURL)
    preparingAsset = asset
    asset.loadTracks(withMediaType: .audio) { [weak self] _, error in
      guard let self else { return }
      self.runOnMain {
        guard self.loadGeneration == generation, self.preparingAsset === asset else { return }
        self.preparingAsset = nil
        if let error {
          self.itemFailed = true
          let nsError = error as NSError
          self.emit(Self.eventError, [
            "code": "\(nsError.domain):\(nsError.code)",
            "message": nsError.localizedDescription,
          ])
          self.emitState("error")
          return
        }
        let item = AVPlayerItem(asset: asset)
        self.observe(item: item)
        player.replaceCurrentItem(with: item)
      }
    }
  }

  func play() {
    if preparingAsset != nil { return }
    let player = ensurePlayer()
    activateSession()
    reachedEnd = false
    // playImmediately 同时启动播放并复挂 speed(裸 play() 会把 rate 重置为 1.0)。
    player.playImmediately(atRate: speed)
  }

  func pause() {
    player?.pause()
  }

  func stop() {
    invalidatePreparation()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    reachedEnd = false
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    emitState("idle")
    emitProgressValues(positionMs: 0, durationMs: 0)
  }

  func seek(positionMs: Double) {
    guard let player, preparingAsset == nil else { return }
    let target = CMTime(seconds: max(0, positionMs) / 1000, preferredTimescale: 600)
    // 零容差:进度条必须落在用户松手处,不是最近关键帧。
    player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
      self?.emitProgress()
    }
  }

  func setVolume(_ volume: Float) {
    player?.volume = min(max(volume, 0), 1)
  }

  func setSpeed(_ rate: Float) {
    let previous = speed
    speed = min(max(rate, 0.5), 3)
    // 只在播放中碰 rate —— 给暂停的 player 赋 rate 会直接开始播放。
    if let player, player.timeControlStatus == .playing { player.rate = speed }
    // tick 间隔按媒体时间计,需按新速率重推(songloft 实测)。
    if let player, speed != previous { installTimeObserver(on: player) }
  }

  func release() {
    invalidatePreparation()
    if let player, let timeObserver { player.removeTimeObserver(timeObserver) }
    timeObserver = nil
    itemStatusObservation = nil
    timeControlObservation = nil
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = nil
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    try? AVAudioSession.sharedInstance().setActive(false)
  }

  // MARK: - 生命周期

  private func ensurePlayer() -> AVPlayer {
    if let player { return player }
    let created = AVPlayer()
    created.automaticallyWaitsToMinimizeStalling = true
    timeControlObservation = created.observe(\.timeControlStatus, options: [.new]) {
      [weak self] player, _ in
      self?.runOnMain { self?.onTimeControlStatus(of: player) }
    }
    installTimeObserver(on: created)
    player = created
    return created
  }

  private func invalidatePreparation() {
    loadGeneration += 1
    preparingAsset?.cancelLoading()
    preparingAsset = nil
  }

  /// `.playback` 类别:锁屏/切后台继续播(UIBackgroundModes: audio 配合),
  /// 且不理会静音键。默认 .soloAmbient 会让 app 一离开前台就停。
  private func activateSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .default)
    try? session.setActive(true)
  }

  private func installTimeObserver(on player: AVPlayer) {
    if let timeObserver { player.removeTimeObserver(timeObserver) }
    timeObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(
        seconds: Self.progressIntervalSeconds * Double(speed),
        preferredTimescale: 600
      ),
      queue: .main
    ) { [weak self] _ in
      self?.emitProgress()
    }
  }

  private func observe(item: AVPlayerItem) {
    itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      self?.runOnMain { self?.onItemStatus(of: item) }
    }
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = NotificationCenter.default.addObserver(
      forName: AVPlayerItem.didPlayToEndTimeNotification,
      object: item,
      queue: .main
    ) { [weak self, weak item] _ in
      guard let self, let item, self.player?.currentItem === item else { return }
      self.onReachedEnd()
    }
  }

  // MARK: - 播放器状态 → facade 事件

  private func onItemStatus(of item: AVPlayerItem) {
    guard player?.currentItem === item else { return }
    switch item.status {
    case .readyToPlay:
      emitState("ready")
    case .failed:
      itemFailed = true
      let error = item.error as NSError?
      emit(Self.eventError, [
        "code": error.map { "\($0.domain):\($0.code)" } ?? "ERROR_UNKNOWN",
        "message": error?.localizedDescription ?? "playback error",
      ])
      emitState("error")
    default:
      break
    }
  }

  private func onTimeControlStatus(of player: AVPlayer) {
    guard self.player === player, !itemFailed, preparingAsset == nil,
      player.currentItem != nil
    else { return }
    switch player.timeControlStatus {
    case .playing:
      emitState("playing")
      // Kotlin 侧首个 tick 立即发;periodic observer 没有等价物,手动补一发,
      // 否则 playing 后消费者读到的进度最多旧一个间隔(songloft 实测)。
      emitProgress()
    case .waitingToPlayAtSpecifiedRate:
      // 停顿/缓冲 —— Android 侧同款报 loading。
      emitState("loading")
    case .paused:
      if !reachedEnd { emitState("paused") }
    @unknown default:
      break
    }
  }

  private func onReachedEnd() {
    reachedEnd = true
    emitProgress()
    emitState("completed")
  }

  // MARK: - 事件

  private func emit(_ event: String, _ payload: [String: Any]) {
    sink?(event, payload)
  }

  private func emitState(_ state: String) {
    emit(Self.eventStateChanged, ["state": state])
  }

  private func emitProgress() {
    guard let item = player?.currentItem else { return }
    emitProgressValues(
      positionMs: Self.milliseconds(item.currentTime()),
      durationMs: Self.milliseconds(item.duration)
    )
  }

  private func emitProgressValues(positionMs: Double, durationMs: Double) {
    emit(Self.eventProgress, ["positionMs": positionMs, "durationMs": durationMs])
  }

  /// CMTime → ms;indefinite/NaN(直播流、未知时长)归零。
  private static func milliseconds(_ time: CMTime) -> Double {
    let seconds = CMTimeGetSeconds(time)
    return seconds.isFinite && seconds > 0 ? seconds * 1000 : 0
  }

  // MARK: - 锁屏 / 控制中心

  /// 远程(锁屏/耳机)播放控制直接驱动引擎;队列由 JS store 持有,
  /// 播放结束的自动切歌由 JS 在 completed 事件里推进(与 Web 一致)。
  private func installRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in
      self?.runOnMain { self?.play() }
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.runOnMain { self?.pause() }
      return .success
    }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.runOnMain {
        guard let self else { return }
        if self.player?.timeControlStatus == .playing { self.pause() } else { self.play() }
      }
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self?.runOnMain { self?.seek(positionMs: event.positionTime * 1000) }
      return .success
    }
  }
}
