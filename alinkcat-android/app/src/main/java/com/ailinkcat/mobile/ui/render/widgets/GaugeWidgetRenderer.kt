package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.GaugeWidget
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.WarningOrange
import com.ailinkcat.mobile.utils.ColorParser
import kotlin.math.min

/**
 * 仪表盘控件：支持 ring / number / bar 三种样式，数值平滑过渡，无数据时显示 "--"。
 * 环半径 = min(宽,高) × 0.35；文字大小随容器自适应。
 */
@Composable
fun GaugeWidgetRenderer(
    widget: GaugeWidget,
    value: Float?
) {
    val min = (widget.min ?: 0).toFloat()
    val max = (widget.max ?: 100).toFloat()
    // 先滤 NaN/无穷再 clamp（coerceIn 会放过 NaN）；文本与图形共用同一值
    val displayValue = value?.takeIf { it.isFinite() }?.coerceIn(min, max)
    val rawRatio = if (displayValue != null && max > min) {
        ((displayValue - min) / (max - min)).coerceIn(0f, 1f)
    } else {
        0f
    }
    val ratio by animateFloatAsState(
        targetValue = rawRatio,
        animationSpec = tween(durationMillis = 500),
        label = "gauge"
    )
    val color = when {
        rawRatio < 0.5f -> ColorParser.parse(widget.ringColorLow, MaterialTheme.colorScheme.primary)
        rawRatio < 0.8f -> ColorParser.parse(widget.ringColorMid, WarningOrange)
        else -> ColorParser.parse(widget.ringColorHigh, ErrorRed)
    }

    when (widget.displayStyle ?: "ring") {
        "number" -> NumberGauge(widget, displayValue, color)
        "bar" -> BarGauge(widget, displayValue, ratio, color)
        else -> RingGauge(widget, displayValue, ratio, color)
    }
}

@Composable
private fun RingGauge(widget: GaugeWidget, value: Float?, ratio: Float, color: Color) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.18f).coerceIn(12f, 28f).sp
        val adaptiveLabelSize = (min(cw, ch) * 0.08f).coerceIn(8f, 14f).sp

        Box(contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.aspectRatio(1f).fillMaxSize()) {
                val thickness = (widget.ringThickness ?: 14).dp.toPx()
                val halfStroke = thickness / 2f
                // 圆心居中，半径留出描边宽度，圆不超出边界
                val cx = size.width / 2f
                val cy = size.height / 2f
                val radius = min(cx, cy) - halfStroke - 2.dp.toPx()
                val topLeft = Offset(cx - radius, cy - radius)
                val arcSize = Size(radius * 2, radius * 2)
                drawArc(
                    color = Color.White.copy(alpha = 0.12f),
                    startAngle = 0f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = thickness, cap = StrokeCap.Round)
                )
                drawArc(
                    color = color,
                    startAngle = -90f,
                    sweepAngle = 360f * ratio,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = thickness, cap = StrokeCap.Round)
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = formatValue(value, widget.unit),
                    color = Color.White,
                    fontSize = adaptiveValueSize,
                    fontWeight = FontWeight.Bold
                )
                if (widget.label.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = widget.label,
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = adaptiveLabelSize
                    )
                }
            }
        }
    }
}

@Composable
private fun NumberGauge(widget: GaugeWidget, value: Float?, color: Color) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.22f).coerceIn(16f, 36f).sp
        val adaptiveLabelSize = (min(cw, ch) * 0.08f).coerceIn(9f, 14f).sp

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = formatValue(value, widget.unit),
                color = color,
                fontSize = adaptiveValueSize,
                fontWeight = FontWeight.Bold
            )
            if (widget.label.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = adaptiveLabelSize
                )
            }
        }
    }
}

@Composable
private fun BarGauge(widget: GaugeWidget, value: Float?, ratio: Float, color: Color) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp)
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.2f).coerceIn(14f, 30f).sp
        val adaptiveLabelSize = (min(cw, ch) * 0.07f).coerceIn(8f, 13f).sp
        val barHeight = (ch * 0.1f).coerceIn(6f, 14f).dp

        Column(
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = formatValue(value, widget.unit),
                color = Color.White,
                fontSize = adaptiveValueSize,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
            if (widget.label.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = adaptiveLabelSize,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(barHeight)
                    .clip(RoundedCornerShape(barHeight / 2))
                    .background(Color.White.copy(alpha = 0.12f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(ratio.coerceIn(0f, 1f))
                        .height(barHeight)
                        .clip(RoundedCornerShape(barHeight / 2))
                        .background(color)
                )
            }
        }
    }
}

private fun formatValue(value: Float?, unit: String?): String {
    if (value == null || !value.isFinite()) return "--"
    val text = if (value % 1f == 0f) value.toInt().toString() else String.format("%.1f", value)
    return if (unit.isNullOrBlank()) text else "$text $unit"
}
