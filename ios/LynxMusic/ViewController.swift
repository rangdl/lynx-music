import UIKit

/**
 * 唯一的宿主 ViewController:构建一个 LynxView,指向内嵌的 main.lynx.bundle。
 * 结构(builder block + preferredLayout + .exact + loadTemplate)照抄官方
 * integrating-lynx-demo-projects 的 HelloLynxSwift demo,加上 songloft 的两条
 * 实测结论:
 *  1. LynxView 铺满整屏(含状态栏/小白条),页面自己用 env(safe-area-inset-*)避让;
 *     内缩 viewport 会让引擎不绘制上下两条带,露出系统底色。
 *  2. 一切在 viewDidLayoutSubviews 里做 —— 那是 view.bounds 首次等于真实窗口
 *     尺寸的时机,更早构建会以错误的启动帧高度渲染。
 */
class ViewController: UIViewController {
  /// LynxMusicTemplateProvider 会补 .bundle 扩展名。
  private static let bundleURL = "main.lynx"

  private var lynxView: LynxView?
  private let templateProvider = LynxMusicTemplateProvider()
  private var laidOutSize: CGSize = .zero

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let frame = view.bounds
    guard frame.width > 0, frame.height > 0 else { return }

    if let lynxView {
      guard frame.size != laidOutSize else { return }
      laidOutSize = frame.size
      lynxView.frame = frame
      lynxView.updateViewport(withPreferredLayoutWidth: frame.width,
                              preferredLayoutHeight: frame.height)
      return
    }

    laidOutSize = frame.size
    let screenSize = view.window?.windowScene?.screen.bounds.size ?? view.bounds.size
    let provider = templateProvider
    let lynxView = LynxView { builder in
      builder.config = Self.buildConfig(provider: provider)
      builder.fetcher = provider
      builder.templateResourceFetcher = provider
      builder.screenSize = screenSize
      builder.fontScale = 1.0
    }
    lynxView.preferredLayoutWidth = frame.width
    lynxView.preferredLayoutHeight = frame.height
    lynxView.layoutWidthMode = .exact
    lynxView.layoutHeightMode = .exact
    lynxView.frame = frame
    view.addSubview(lynxView)
    self.lynxView = lynxView

    // LynxLoadMeta 把 globalProps 带进 load:首帧就拿到数据,无需异步 getter。
    // API 形态照 songloft(Lynx 4.0.1):属性赋值 + LynxTemplateData(dictionary:)。
    let meta = LynxLoadMeta()
    meta.url = Self.bundleURL
    meta.globalProps = LynxTemplateData(dictionary: [:])
    lynxView.loadTemplate(meta)
  }

  /// 注册原生模块。LynxAudio 与 Web 侧 audio-host.js 同协议(见 platform/audio.ts)。
  private static func buildConfig(provider: LynxMusicTemplateProvider) -> LynxConfig {
    let config = LynxConfig(provider: provider)
    config.register(LynxAudioModule.self)
    return config
  }
}
