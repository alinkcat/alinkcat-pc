package com.ailinkcat.mobile.utils

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import java.io.File
import kotlin.math.max

/** loads bitmaps from an installed theme pack, e.g. backgroundImage = "assets/bg.jpg" */
object ImageLoader {

    private const val TAG = "ImageLoader"

    /** [maxDimension] caps the long edge (default 2048); decode bounds first, then sample
     *  by powers of 2 so large images don't blow up memory */
    fun loadBitmap(themeDir: File, themeId: String, imagePath: String?, maxDimension: Int = 2048): Bitmap? {
        if (imagePath.isNullOrBlank()) return null
        val file = File(themeDir, "$themeId/$imagePath")
        Log.d(TAG, "Loading: ${file.absolutePath}, exists=${file.exists()}")
        return try {
            if (file.exists()) {
                // pass 1: bounds only
                val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.absolutePath, boundsOpts)
                var sample = 1
                while (max(boundsOpts.outWidth, boundsOpts.outHeight) / sample > maxDimension) {
                    sample *= 2
                }
                // pass 2: decode at the sample size
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
