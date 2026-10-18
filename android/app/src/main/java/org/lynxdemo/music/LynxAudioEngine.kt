package org.lynxdemo.music

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.media3.common.AudioAttributes as ExoAudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource

/**
 * 进程级音频引擎(iOS 对应 LynxAudioEngine.swift,Web 对应 web/audio-host.js)。
 * 照 songloft SongloftAudioEngine 大幅精简:去掉前台 Service/MediaSession 通知、
 * 断点续播、歌词、EQ —— 保留 ExoPlayer + 音频焦点 + 事件回传。
 *
 * 事件载荷与 platform/audio.ts 的协议逐字节一致:
 *   LynxAudio.stateChanged { state: idle|loading|ready|playing|paused|completed|error }
 *   LynxAudio.progress     { positionMs, durationMs }
 *   LynxAudio.error        { code, message }
 *
 * @LynxMethod 调用来自 BTS 线程;ExoPlayer 单线程 —— 所有入口经 runOnMain 汇聚。
 */
@UnstableApi
object LynxAudioEngine {
    private const val TAG = "LynxAudio"

    // 事件名必须与 platform/audio.ts 的 EVT 逐字节一致。
    const val EVENT_STATE_CHANGED = "LynxAudio.stateChanged"
    const val EVENT_PROGRESS = "LynxAudio.progress"
    const val EVENT_ERROR = "LynxAudio.error"

    private const val PROGRESS_INTERVAL_MS = 500L

    /** 由 module 安装;转发事件到 LynxContext.sendGlobalEvent。 */
    @Volatile
    var sink: ((String, Map<String, Any>) -> Unit)? = null

    private var player: ExoPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressPostedAt = 0L
    private var appContext: Context? = null
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null
    private var speed = 1.0f

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(state: Int) {
            when (state) {
                Player.STATE_READY -> emitState("ready")
                Player.STATE_ENDED -> {
                    emitProgress()
                    emitState("completed")
                }
                Player.STATE_BUFFERING -> emitState("loading")
                Player.STATE_IDLE -> {}
            }
            scheduleProgress()
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (isPlaying) {
                emitState("playing")
                // Android 侧首个 tick 立即发(与 iOS/Web 对齐)。
                emitProgress()
            } else if (player?.playbackState != Player.STATE_ENDED) {
                emitState("paused")
            }
            scheduleProgress()
        }

        override fun onPlayerError(error: PlaybackException) {
            emit(
                EVENT_ERROR,
                mapOf("code" to (error.errorCodeName ?: "playback_error"),
                      "message" to (error.message ?: "playback error")),
            )
            emitState("error")
        }
    }

    fun runOnMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    // -- 源与传输 --

    fun load(context: Context, url: String) {
        val ctx = appContext ?: context.applicationContext.also { appContext = it }
        val p = ensurePlayer(ctx)
        p.stop()
        p.clearMediaItems()
        emitState("loading")
        // 音源流常经 302 且 http/https 混杂;DefaultHttpDataSource 默认拒绝跨协议
        // 重定向(songloft 实测:所有此类流死在 302 上)。
        val httpFactory = DefaultHttpDataSource.Factory()
            .setAllowCrossProtocolRedirects(true)
        val item = MediaItem.Builder().setUri(url).build()
        val source = DefaultMediaSourceFactory(DefaultDataSource.Factory(ctx, httpFactory))
            .createMediaSource(item)
        try {
            p.setMediaSource(source)
            p.prepare()
        } catch (error: Throwable) {
            emit(EVENT_ERROR, mapOf("code" to "load_failed", "message" to (error.message ?: "load failed")))
            emitState("error")
        }
    }

    fun play(context: Context) {
        ensurePlayer(context).play()
    }

    fun pause() {
        player?.pause()
    }

    fun stop() {
        player?.let {
            it.stop()
            it.clearMediaItems()
        }
        emitState("idle")
        emitProgressValues(0, 0)
    }

    fun seek(positionMs: Long) {
        player?.seekTo(if (positionMs < 0) 0 else positionMs)
        emitProgress()
    }

    fun setVolume(volume: Float, context: Context) {
        // 直接驱动 STREAM_MUSIC 系统音量(Web 侧 <audio> 也作用于同一流)。
        val am = audioManager
            ?: (context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager)?.also { audioManager = it }
            ?: return
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = (volume * max).toInt().coerceIn(0, max)
        am.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
    }

    fun setSpeed(rate: Float) {
        player?.setPlaybackSpeed(rate.coerceIn(0.5f, 3f))
        speed = rate
    }

    fun release() {
        player?.removeListener(playerListener)
        player?.release()
        player = null
        focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        focusRequest = null
        audioManager = null
        appContext = null
    }

    // -- 内部 --

    private fun ensurePlayer(context: Context): ExoPlayer {
        player?.let { return it }
        val attributes = ExoAudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()
        val created = ExoPlayer.Builder(context.applicationContext)
            .setAudioAttributes(attributes, /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .build()
        created.addListener(playerListener)
        player = created
        requestAudioFocus(context)
        return created
    }

    private fun requestAudioFocus(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        audioManager = am
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .build()
        focusRequest = request
        am.requestAudioFocus(request)
    }

    private fun scheduleProgress() {
        val now = SystemClock.elapsedRealtime()
        if (now - progressPostedAt < PROGRESS_INTERVAL_MS) return
        progressPostedAt = now
        mainHandler.postDelayed({ emitProgress() }, PROGRESS_INTERVAL_MS)
    }

    private fun emitState(state: String) {
        emit(EVENT_STATE_CHANGED, mapOf("state" to state))
    }

    private fun emitProgress() {
        val p = player ?: return
        emitProgressValues(p.currentPosition.coerceAtLeast(0), p.duration.coerceAtLeast(0))
    }

    private fun emitProgressValues(positionMs: Long, durationMs: Long) {
        emit(EVENT_PROGRESS, mapOf("positionMs" to positionMs, "durationMs" to durationMs))
    }

    private fun emit(event: String, payload: Map<String, Any>) {
        Log.d(TAG, "$event $payload")
        sink?.invoke(event, payload)
    }
}
