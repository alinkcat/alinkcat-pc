package com.ailinkcat.mobile.utils

import androidx.compose.ui.graphics.Color

/** 颜色解析工具：支持 #RGB、#RRGGBB、#AARRGGBB。 */
object ColorParser {

    /** 解析十六进制颜色字符串，8 位按 AARRGGBB（Android 惯例）。 */
    fun parse(hex: String?, default: Color = Color.Transparent): Color {
        if (hex.isNullOrBlank()) return default
        var raw = hex.trim().removePrefix("#")
        if (raw.length == 3) {
            raw = raw[0].toString().repeat(2) +
                raw[1].toString().repeat(2) +
                raw[2].toString().repeat(2) + "FF"
        } else if (raw.length == 6) {
            raw += "FF"
        }
        if (raw.length != 8) return default
        val value = raw.toLongOrNull(16) ?: return default
        return Color(
            red = ((value shr 24) and 0xFF) / 255f,
            green = ((value shr 16) and 0xFF) / 255f,
            blue = ((value shr 8) and 0xFF) / 255f,
            alpha = (value and 0xFF) / 255f
        )
    }

    /** 应用透明度百分比（0-100）。 */
    fun withOpacity(color: Color, opacityPercent: Int?): Color {
        if (opacityPercent == null) return color
        val factor = opacityPercent.coerceIn(0, 100) / 100f
        return color.copy(alpha = color.alpha * factor)
    }
}
