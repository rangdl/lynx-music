package org.lynxdemo.music

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.Callback
import com.lynx.tasm.behavior.LynxContext

/**
 * Lynx 原生模块 `NativeModules.LynxAudio` —— Android 音频后端(ExoPlayer,
 * 经 [LynxAudioEngine])。Web 侧对应 web/audio-host.js;协议与 platform/audio.ts
 * 逐字节一致。事件经 LynxContext.sendGlobalEvent 回 BTS GlobalEventEmitter
 * (songloft 同款:数组包 payload)。
 *
 * 注册:MusicApplication.onCreate 里 LynxEnv.inst().registerModule("LynxAudio", ...)。
 */
class LynxAudioModule(context: Context) : LynxModule(context) {

    private fun androidContext(): Context = (mContext as LynxContext).getContext()

    private fun lynxContext(): LynxContext = mContext as LynxContext

    private fun ensureSink() {
        // 幂等安装:最新模块实例独占投递(页面重载不喂旧 context)。
        LynxAudioEngine.sink = { event, payload ->
            val params = JavaOnlyArray()
            params.pushMap(com.lynx.react.bridge.JavaOnlyMap.from(payload))
            lynxContext().sendGlobalEvent(event, params)
        }
    }

    @LynxMethod
    fun load(url: String) {
        ensureSink()
        val ctx = androidContext()
        LynxAudioEngine.runOnMain { LynxAudioEngine.load(ctx, url) }
    }

    @LynxMethod
    fun play() {
        ensureSink()
        val ctx = androidContext()
        LynxAudioEngine.runOnMain { LynxAudioEngine.play(ctx) }
    }

    @LynxMethod
    fun pause() {
        LynxAudioEngine.runOnMain { LynxAudioEngine.pause() }
    }

    @LynxMethod
    fun stop() {
        LynxAudioEngine.runOnMain { LynxAudioEngine.stop() }
    }

    @LynxMethod
    fun seek(positionMs: Double) {
        LynxAudioEngine.runOnMain { LynxAudioEngine.seek(positionMs.toLong()) }
    }

    @LynxMethod
    fun setVolume(volume: Double) {
        val ctx = androidContext()
        LynxAudioEngine.runOnMain { LynxAudioEngine.setVolume(volume.toFloat(), ctx) }
    }

    @LynxMethod
    fun setSpeed(rate: Double) {
        LynxAudioEngine.runOnMain { LynxAudioEngine.setSpeed(rate.toFloat()) }
    }

    @LynxMethod
    fun dispose() {
        LynxAudioEngine.runOnMain { LynxAudioEngine.release() }
    }
}
