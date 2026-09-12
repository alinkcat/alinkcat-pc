package com.ailinkcat.mobile.utils

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.io.File
import kotlin.math.max

/** 图片加载：从主题包 files/themes/{themeId}/{imagePath} 加载位图（如 backgroundImage = "assets/bg.jpg"）。 */
object ImageLoader {

    private const val TAG = "ImageLoader"

    /** 加载主题包图片。[maxDimension]：长边像素上限（默认 2048），先读尺寸再按 2 的幂采样，避免大图解码撑爆内存。 */
    fun loadBitmap(themeDir: File, themeId: String, imagePath: String?, maxDimension: Int = 2048): Bitmap? {
        if (imagePath.isNullOrBlank()) return null
        val file = File(themeDir, "$themeId/$imagePath")
        Log.d(TAG, "Loading: ${file.absolutePath}, exists=${file.exists()}")
        return try {
            if (file.exists()) {
                // 第一遍：仅读边界
                val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.absolutePath, boundsOpts)
                var sample = 1
                while (max(boundsOpts.outWidth, boundsOpts.outHeight) / sample > maxDimension) {
                    sample *= 2
                }
                // 第二遍：按采样率解码
                val opts = BitmapFactory.Options().apply {
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                    inSampleSize = sample
                }
                BitmapFactory.decodeFile(file.absolutePath, opts)
            } else {
                Log.w(TAG, "Image not found: ${file.absolutePath}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load image: ${e.message}")
            null
        }
    }
}
