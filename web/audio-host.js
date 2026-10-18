/**
 * Web 主线程音频宿主(套用 songloft-player-lynx 的 audio-host.js 方案)。
 *
 * 在主线程创建 HTMLAudioElement,经 lynxView.nativeModulesMap 注册为
 * `NativeModules.LynxAudio`,worker 里的代码与真机走同一条原生模块路径。
 *
 * 加载时机约束(见 web/index.html 注释):必须在 web-core client 模块之前
 * 加载,nativeModulesMap 才能在 <lynx-view> custom element 升级时已就位。
 *
 * 事件回传:lynxView.sendGlobalEvent(name, [payload]) —— 第二个参数必须是
 * 【数组】:web-core 端是 `listener.apply(ctx, params)`,传裸对象没有 length,
 * apply 会以零参数调用监听器,songloft 踩过的坑。
 */
;(function () {
  'use strict'

  var lynxView = document.getElementById('app')
  if (!lynxView) return

  var TICK_MS = 250

  var STATE_IDLE = 'idle'
  var STATE_LOADING = 'loading'
  var STATE_READY = 'ready'
  var STATE_PLAYING = 'playing'
  var STATE_PAUSED = 'paused'
  var STATE_COMPLETED = 'completed'
  var STATE_ERROR = 'error'

  var AUDIO_EVENT = {
    sourceReady: 'LynxAudio.sourceReady',
    stateChanged: 'LynxAudio.stateChanged',
    progress: 'LynxAudio.progress',
    error: 'LynxAudio.error',
  }

  // ── audio 元素 ──

  var audio = new Audio()
  audio.preload = 'auto'
  // 不参与布局,仅便于诊断与浏览器媒体控件;不 append 也能播放,append 是可观测性选择
  audio.style.display = 'none'
  document.body.appendChild(audio)

  var state = STATE_IDLE
  var positionMs = 0
  var durationMs = 0
  var progressTimer = null
  // 每次 load 换新元素并递增代数,迟到的旧元素事件不得污染新源状态(songloft 同款)。
  var sourceGeneration = 0

  // ── 事件回传 ──

  function sendEvent(name, data) {
    try {
      // 第二参数必须是数组:sendGlobalEvent(name, [payload])
      lynxView.sendGlobalEvent(name, [data])
    } catch (_) {}
  }

  function emitState(newState) {
    if (state === newState) return
    state = newState
    sendEvent(AUDIO_EVENT.stateChanged, { state: state })
  }

  function emitProgress() {
    sendEvent(AUDIO_EVENT.progress, {
      positionMs: positionMs,
      durationMs: durationMs,
    })
  }

  function emitError(code, message) {
    sendEvent(AUDIO_EVENT.error, { code: code, message: message })
  }

  // ── 进度定时器 ──

  function startProgress() {
    stopProgress()
    progressTimer = setInterval(function () {
      if (audio && !audio.paused && !audio.ended) {
        positionMs = Math.round((audio.currentTime || 0) * 1000)
        durationMs = Math.round((audio.duration || 0) * 1000)
        emitProgress()
      }
    }, TICK_MS)
  }

  function stopProgress() {
    if (progressTimer != null) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  }

  // ── 元素事件 ──

  function bindAudioEvents(element) {
    element.addEventListener('loadstart', function () { emitState(STATE_LOADING) })

    element.addEventListener('loadedmetadata', function () {
      durationMs = Math.round((element.duration || 0) * 1000)
      emitState(STATE_READY)
      emitProgress()
      sendEvent(AUDIO_EVENT.sourceReady, { positionMs: positionMs })
    })

    element.addEventListener('play', function () {
      emitState(STATE_PLAYING)
      startProgress()
    })

    element.addEventListener('pause', function () {
      stopProgress()
      if (!element.ended) emitState(STATE_PAUSED)
    })

    element.addEventListener('ended', function () {
      stopProgress()
      positionMs = durationMs
      emitProgress()
      emitState(STATE_COMPLETED)
    })

    element.addEventListener('error', function () {
      stopProgress()
      var err = element.error
      emitState(STATE_ERROR)
      emitError(
        err ? 'MEDIA_ERR_' + err.code : 'unknown',
        (err && err.message) || 'audio playback error',
      )
    })
  }
  bindAudioEvents(audio)

  // ── native module 实现(worker 经 call() 调到这里,参数是位置数组) ──

  var lynxAudio = {
    load: function (url) {
      stopProgress()
      // 每源新元素:旧元素迟到事件不会误标新源(songloft 方案)
      var outgoing = audio
      audio = new Audio()
      audio.preload = 'auto'
      bindAudioEvents(audio)
      outgoing.pause()
      outgoing.removeAttribute('src')
      outgoing.load()
      ++sourceGeneration
      positionMs = 0
      durationMs = 0
      emitState(STATE_LOADING)
      audio.src = url || ''
    },

    play: function () {
      if (state === STATE_COMPLETED) audio.currentTime = 0
      audio.play().catch(function (e) {
        // 浏览器自动播放策略拦截等
        emitState(STATE_ERROR)
        emitError('play_blocked', (e && e.message) || 'playback was prevented')
      })
    },

    pause: function () {
      audio.pause()
    },

    stop: function () {
      ++sourceGeneration
      audio.pause()
      audio.currentTime = 0
      audio.src = ''
      stopProgress()
      positionMs = 0
      emitState(STATE_IDLE)
      emitProgress()
    },

    seek: function (ms) {
      var sec = Math.max(0, Math.min(ms / 1000, audio.duration || 0))
      audio.currentTime = sec
      positionMs = Math.round(sec * 1000)
      emitProgress()
    },

    setVolume: function (v) {
      audio.volume = Math.min(1, Math.max(0, v))
    },

    setSpeed: function (rate) {
      audio.playbackRate = Math.min(3, Math.max(0.5, rate))
    },

    dispose: function () {
      stopProgress()
      audio.pause()
      audio.src = ''
      audio.removeAttribute('src')
    },
  }

  // ── 注册(songloft 实测:nativeModulesMap 的值必须是【ESM URL 字符串】,
  //    worker 会 import() 它;直接塞对象会 import("[object Object]") 全体静默失败) ──

  lynxView.nativeModulesMap = Object.assign(
    {},
    lynxView.nativeModulesMap || {},
    {
      LynxAudio: new URL('./lynx-audio-module.js', document.baseURI).href,
    },
  )

  // worker→主线程方法调用在此分发
  var previousCall = lynxView.onNativeModulesCall
  lynxView.onNativeModulesCall = function (name, data, moduleName) {
    if (moduleName === 'LynxAudio') {
      var fn = lynxAudio[name]
      if (typeof fn === 'function') return fn.apply(lynxAudio, data || [])
      return undefined
    }
    return previousCall ? previousCall(name, data, moduleName) : undefined
  }
})()
