package org.lynxdemo.music

import android.app.Application
import com.lynx.tasm.LynxEnv

/**
 * App 入口:注册 LynxAudio 原生模块(照官方 Native Modules 指南的模式,
 * songloft SongloftApplication 同款)。必须在第一个 LynxView 构建前注册。
 */
class MusicApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        LynxEnv.inst().registerModule("LynxAudio", LynxAudioModule::class.java)
    }
}
