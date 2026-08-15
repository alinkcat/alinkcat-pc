package com.ailinkcat.mobile.utils

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.io.File

/**
 * 图片加载工具：从主题包 assets/ 目录加载位图。
 * 完整路径：files/themes/{themeId}/{imagePath}
 * 例如 backgroundImage = "assets/bg.jpg" → files/themes/{themeId}/assets/bg.jpg
 */
object ImageLoader {

    private const val TAG = "ImageLoader"

    fun loadBitmap(themeDir: File, themeId: String, imagePath: String?): Bitmap? {
        if (imagePath.isNullOrBlank()) return null
        val file = File(themeDir, "$themeId/$imagePath")
        Log.d(TAG, "Loading: ${file.absolutePath}, exists=${file.exists()}")
        return try {
            if (file.exists()) {
                val opts = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
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
