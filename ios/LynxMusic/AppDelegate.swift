import UIKit

/**
 * App 入口:在任何 LynxView 存在前把 Lynx 运行时拉起来(照 songloft AppDelegate)。
 * Lynx 的各服务 pod 经 LynxLazyRegister 自注册,触碰 LynxEnv.sharedInstance()
 * 才会 flush 注册 —— 必须先于第一个 LynxView 构建。
 *
 * 本宿主没有自定义 HTTP service:网络由 SDK 的 LynxService/Http 承担
 * (songloft 替换它是为了支持自签 TLS,我们暂无此需求)。
 */
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    LynxEnv.sharedInstance()
    return true
  }
}
