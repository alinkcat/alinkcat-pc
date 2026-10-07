package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.DrawStyle
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.ailinkcat.mobile.domain.models.ShapeWidget
import com.ailinkcat.mobile.utils.ColorParser
import kotlin.math.min

@Composable
fun ShapeWidgetRenderer(widget: ShapeWidget) {
    val fill = ColorParser.parse(widget.fillColor, Color.Transparent)
    val gradientEnd = ColorParser.parse(widget.gradientTo, fill)
    val strokeColor = ColorParser.parse(widget.strokeColor, Color.Transparent)
    val brush = if (widget.gradientTo.isNullOrBlank()) {
        SolidColor(fill)
    } else {
        Brush.linearGradient(listOf(fill, gradientEnd))
    }
    val shapeType = widget.shapeType

    Canvas(modifier = Modifier.fillMaxSize()) {
        val strokeWidth = (widget.strokeWidth ?: 0).dp.toPx()
        val stroke = if (strokeWidth > 0f) Stroke(width = strokeWidth) else null

        // fill first, stroke on top; drawing with Stroke style alone would hollow it out
        val borderRadiusPx = (widget.borderRadius ?: 12).dp.toPx()
        drawShape(brush, shapeType, Fill, borderRadiusPx)
        if (stroke != null) {
            drawShape(SolidColor(strokeColor), shapeType, stroke, borderRadiusPx)
        }
    }
}

private fun DrawScope.drawShape(brush: Brush, shapeType: String?, style: DrawStyle, borderRadiusPx: Float) {
    val w = size.width
    val h = size.height
    when (shapeType?.lowercase()) {
        "circle" -> {
            val radius = min(w, h) / 2f
            drawCircle(brush, radius, Offset(w / 2f, h / 2f), style = style)
        }

        "rounded" -> {
            drawRoundRect(
                brush,
                topLeft = Offset.Zero,
                size = size,
                cornerRadius = CornerRadius(borderRadiusPx),
                style = style
            )
        }

        "triangle" -> {
            drawPath(
                Path().apply {
                    moveTo(w / 2f, 0f)
                    lineTo(w, h)
                    lineTo(0f, h)
                    close()
                },
                brush,
                style = style
            )
        }

        "diamond" -> {
            drawPath(
                Path().apply {
                    moveTo(w / 2f, 0f)
                    lineTo(w, h / 2f)
                    lineTo(w / 2f, h)
                    lineTo(0f, h / 2f)
                    close()
                },
                brush,
                style = style
            )
        }

        else -> drawRect(brush, style = style)
    }
}
