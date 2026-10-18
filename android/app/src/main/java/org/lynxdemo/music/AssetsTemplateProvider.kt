package org.lynxdemo.music

import android.content.Context
import com.lynx.tasm.provider.AbsTemplateProvider
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * 从 APK assets 读 Lynx 模板包(照官方 KotlinEmptyProject demo,
 * songloft 同款)。uri 是 asset 路径,如 "main.lynx.bundle"。
 */
class AssetsTemplateProvider(context: Context) : AbsTemplateProvider() {

    private val appContext: Context = context.applicationContext

    override fun loadTemplate(uri: String, callback: Callback) {
        Thread {
            try {
                appContext.assets.open(uri).use { inputStream ->
                    ByteArrayOutputStream().use { out ->
                        val buffer = ByteArray(1024)
                        var length: Int
                        while (inputStream.read(buffer).also { length = it } != -1) {
                            out.write(buffer, 0, length)
                        }
                        callback.onSuccess(out.toByteArray())
                    }
                }
            } catch (e: IOException) {
                callback.onFailed(e.message)
            }
        }.start()
    }
}
