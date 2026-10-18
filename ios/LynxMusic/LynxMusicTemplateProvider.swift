import Foundation

/**
 * 从 App 资源读根模板(内嵌 main.lynx.bundle,离线可跑,无 dev server)。
 * 本地加载路径照官方 HelloLynxSwift provider(songloft 同款)。
 */
class LynxMusicTemplateProvider: NSObject, LynxTemplateProvider,
  LynxDynamicComponentFetcher, LynxTemplateResourceFetcher {
  func loadDynamicComponent(_ url: String, withLoadedBlock callback: @escaping onComponentLoaded) {
    loadTemplate(withUrl: url) { value, error in
      guard let data = value as? Data, error == nil else {
        callback(nil, error ?? NSError(domain: "org.lynxdemo.music", code: 500, userInfo: nil))
        return
      }
      callback(data, nil)
    }
  }

  func fetchTemplate(
    _ request: LynxResourceRequest,
    onComplete callback: @escaping LynxTemplateResourceCompletionBlock
  ) {
    loadTemplate(withUrl: request.url) { value, error in
      guard let data = value as? Data, error == nil else {
        callback(nil, error ?? NSError(domain: "org.lynxdemo.music", code: 500, userInfo: nil))
        return
      }
      // 与 Bridging-Header 的内联函数保持一致:显式 ObjC 初始化器包 NSData。
      callback(LynxTemplateResource(data), nil)
    }
  }

  func fetchSSRData(
    _ request: LynxResourceRequest,
    onComplete callback: @escaping LynxSSRResourceCompletionBlock
  ) {
    callback(nil, NSError(domain: "org.lynxdemo.music", code: 501,
                          userInfo: [NSLocalizedDescriptionKey: "SSR not supported"]))
  }

  func loadTemplate(withUrl url: String!, onComplete callback: LynxTemplateLoadBlock!) {
    guard let url, let path = Bundle.main.path(forResource: url, ofType: "bundle") else {
      let error = NSError(
        domain: "org.lynxdemo.music",
        code: 404,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Template \(url ?? "<nil>").bundle missing from app resources — "
            + "run `npm run build:ios` (copies dist/main.lynx.bundle).",
        ]
      )
      callback(nil, error)
      return
    }
    do {
      let data = try Data(contentsOf: URL(fileURLWithPath: path))
      callback(data, nil)
    } catch {
      NSLog("[LynxMusic] failed to read template %@: %@", path, error.localizedDescription)
      callback(nil, error)
    }
  }
}
