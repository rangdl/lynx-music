package org.lynxdemo.music

import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.lynx.tasm.LynxError
import com.lynx.tasm.LynxLoadMeta
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.TemplateData
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.Behavior
import com.lynx.xelement.XElementBehaviors

/**
 * 唯一全屏宿主 Activity:构建一个 LynxView,TemplateProvider 读 assets 内嵌
 * bundle,渲染 main.lynx.bundle。离线可跑,无 dev server / Explorer。
 * 照 songloft MainActivity 精简(去掉视频 surface/外观推送/返回键转发)。
 */
class MainActivity : android.app.Activity() {
    private var lynxView: LynxView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val view: LynxView = buildLynxView()
        lynxView = view
        setContentView(view)
        // LynxLoadMeta 把 globalProps 带进 load(songloft:setGlobalProps 已废弃)。
        val meta = LynxLoadMeta.Builder()
        meta.setUrl(BUNDLE_URI)
        meta.setGlobalProps(TemplateData.fromMap(emptyMap()))
        view.loadTemplate(meta.build())
    }

    override fun onDestroy() {
        lynxView = null
        super.onDestroy()
    }

    private fun buildLynxView(): LynxView {
        val viewBuilder = LynxViewBuilder()
        // XElement behaviors:<svg>/<input>/overlay/refresh 等元素需要。
        viewBuilder.addBehaviors(XElementBehaviors().create())
        viewBuilder.setTemplateProvider(AssetsTemplateProvider(this))
        return viewBuilder.build(this)
    }

    companion object {
        private const val TAG = "LynxMusic"
        private const val BUNDLE_URI = "main.lynx.bundle"
    }
}
