import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

val packageVersion =
    (JsonSlurper().parse(rootProject.file("../package.json")) as Map<*, *>)["version"].toString()

android {
    namespace = "org.lynxdemo.music"
    compileSdk = 34

    defaultConfig {
        applicationId = "org.lynxdemo.music"
        minSdk = 24
        targetSdk = 34
        // 本地开发版:debug 签名,免证书可直接侧载。CI 无签名 secrets 时也出此包。
        versionCode = 1
        versionName = packageVersion
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // 未配置签名 secrets 时落 debug 签名(songloft:fork PR 编译
            // debug 签名的 release APK,不发布)。
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // ---- Lynx SDK ----
    // 坐标照官方 integrating-lynx-demo-projects;版本 4.0.0(与 iOS 4.0.1 同
    // 4.x 引擎线,bundle targetSdkVersion 3.2 向下兼容)。
    implementation("org.lynxsdk.lynx:lynx:4.0.0")
    implementation("org.lynxsdk.lynx:lynx-jssdk:4.0.0")
    implementation("org.lynxsdk.lynx:primjs:4.0.0")

    // http-service(裸 fetch 的后端 —— 音源取链/URL 导入必需,真机实测缺失报
    // "Lynx Http Service not registered")+ OkHttp(其传输后端)。
    implementation("org.lynxsdk.lynx:lynx-service-http:4.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.9.0")

    // image-service(支撑 <image> 封面)+ Fresco(image-service 的后端,必需)。
    implementation("org.lynxsdk.lynx:lynx-service-image:4.0.0")
    implementation("com.facebook.fresco:fresco:2.3.0")
    implementation("com.facebook.fresco:animated-gif:2.3.0")
    implementation("com.facebook.fresco:animated-webp:2.3.0")
    implementation("com.facebook.fresco:webpsupport:2.3.0")

    // XElement 家族:app 渲染的元素 <svg>(图标)/<input>/<textarea>/overlay(Sheet)。
    implementation("org.lynxsdk.lynx:xelement:4.0.0")
    implementation("org.lynxsdk.lynx:xelement-input:4.0.0")
    implementation("org.lynxsdk.lynx:xelement-overlay:4.0.0")
    implementation("org.lynxsdk.lynx:xelement-svg:4.0.0")
    implementation("org.lynxsdk.lynx:servalsvg:0.1.1")
    implementation("org.lynxsdk.lynx:xelement-refresh:4.0.0")
    // <refresh> 硬依赖,xelement-refresh 的 POM 未声明(songloft 实测:
    // SmartRefreshLayout.onAttachedToWindow 找 ViewPager2 → NoClassDefFoundError)。
    implementation("androidx.viewpager2:viewpager2:1.0.0")

    // 音频:ExoPlayer / media3(与 Lynx 4.0.0 的 media3 版本对齐)。
    implementation("androidx.media3:media3-exoplayer:1.4.0")
    implementation("androidx.media3:media3-common:1.4.0")
    implementation("androidx.media3:media3-datasource:1.4.0")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.1")
}
