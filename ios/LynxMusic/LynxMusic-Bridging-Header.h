//
//  Bridging header — Lynx pods 是纯 ObjC 静态库(无 Swift module),
//  Swift 宿主经这些 import 访问(照官方 HelloLynxSwift / songloft 同款)。
//

#import <Lynx/LynxConfig.h>
#import <Lynx/LynxEnv.h>
#import <Lynx/LynxTemplateProvider.h>
#import <Lynx/LynxDynamicComponentFetcher.h>
#import <Lynx/LynxTemplateResourceFetcher.h>

// 用显式 ObjC 初始化器包 SDK 返回的 NSData。
NS_INLINE LynxTemplateResource * _Nonnull LynxMusicTemplateResourceFromData(NSData * _Nonnull data) {
  return [[LynxTemplateResource alloc] initWithNSData:data];
}

#import <Lynx/LynxView.h>
#import <Lynx/LynxViewClient.h>
#import <Lynx/LynxError.h>

// 原生模块(需 LynxContext sendGlobalEvent)+ 携带 globalProps 进首帧的加载路径。
#import <Lynx/LynxContextModule.h>
#import <Lynx/LynxLoadMeta.h>
#import <Lynx/LynxTemplateData.h>
#import <Lynx/LynxVersion.h>
