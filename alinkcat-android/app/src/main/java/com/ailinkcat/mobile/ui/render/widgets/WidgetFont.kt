package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Adaptive font sizing for widget renderers.
 *
 * themeFontSize is the designer's intended size at the reference cell scale
 * (~109dp short edge, one row of a 6-row grid). Scale it proportionally with
 * the widget's actual short edge, then clamp so text stays legible when the
 * widget is tiny and doesn't explode when it's huge.
 *
 * @param widgetMinEdge  widget short edge in dp (min(width, height))
 * @param themeFontSize  designer hint from theme.json (null or <=0 → defaultSize)
 * @param defaultSize    sp used when the theme gives no size
 * @param minSize        hard floor in sp
 * @param maxSize        hard ceiling in sp
 */
fun adaptiveSp(
    widgetMinEdge: Float,
    themeFontSize: Int?,
    defaultSize: Float,
    minSize: Float,
    maxSize: Float,
): TextUnit {
    val edge = widgetMinEdge.coerceAtLeast(1f)
    val hint = themeFontSize?.takeIf { it > 0 }?.toFloat() ?: defaultSize
    val scaled = hint * (edge / 109f)
    return scaled.coerceIn(minSize, maxSize).sp
}
