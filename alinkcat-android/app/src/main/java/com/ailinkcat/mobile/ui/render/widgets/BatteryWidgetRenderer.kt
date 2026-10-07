package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import com.ailinkcat.mobile.domain.models.BatteryWidget
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.utils.ColorParser
import kotlin.math.min

/**
 * Battery widget: bar / ring / number styles, lowColor kicks in below
 * lowThreshold. Value comes from widgetData["battery"]; shows "--" without data.
 */
@Composable
fun BatteryWidgetRenderer(
    widget: BatteryWidget,
    value: Float?,
    temperature: Float? = null
) {
    val style = widget.batteryStyle ?: "bar"
    val showLevel = widget.showLevel
    val showCharging = widget.showCharging
    val showTemp = widget.showTemp
    val barColor = ColorParser.parse(widget.barColor, SuccessGreen)
    val lowColor = ColorParser.parse(widget.lowColor, ErrorRed)
    val lowThreshold = (widget.lowThreshold ?: 20).toFloat().coerceIn(0f, 100f)

    // filter NaN/infinity before clamping (coerceIn lets NaN through)
    val displayValue = value?.takeIf { it.isFinite() }?.coerceIn(0f, 100f)
    val level = displayValue ?: 0f
    val ratio by animateFloatAsState(
        targetValue = level / 100f,
        animationSpec = tween(durationMillis = 500),
        label = "battery"
    )
    val color = if (displayValue != null && level <= lowThreshold) lowColor else barColor

    when (style) {
        "number" -> NumberBattery(widget, displayValue, temperature, color, showLevel, showCharging, showTemp)
        "ring" -> RingBattery(widget, displayValue, temperature, ratio, color, showLevel, showCharging, showTemp)
        else -> BarBattery(widget, displayValue, temperature, ratio, color, showLevel, showCharging, showTemp)
    }
}

@Composable
private fun NumberBattery(
    widget: BatteryWidget,
    value: Float?,
    temperature: Float?,
    color: Color,
    showLevel: Boolean,
    showCharging: Boolean,
    showTemp: Boolean
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.24f).coerceIn(18f, 44f).sp
        val adaptiveSubSize = (min(cw, ch) * 0.08f).coerceIn(9f, 14f).sp

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            if (showLevel || value == null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = formatLevel(value),
                        color = color,
                        fontSize = adaptiveValueSize,
                        fontWeight = FontWeight.Bold
                    )
                    if (value != null) {
                        Text(
                            text = "%",
                            color = Color.White.copy(alpha = 0.7f),
                            fontSize = adaptiveValueSize * 0.5f,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(start = 2.dp, top = (adaptiveValueSize.value * 0.15f).dp)
                        )
                    }
                }
            }
            if (showCharging || showTemp) {
                Spacer(Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (showCharging) {
                        Text(
                            text = "🔋",
                            fontSize = adaptiveSubSize * 1.4f
                        )
                    }
                    if (showTemp) {
                        Text(
                            text = formatTemp(widget, temperature),
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = adaptiveSubSize
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RingBattery(
    widget: BatteryWidget,
    value: Float?,
    temperature: Float?,
    ratio: Float,
    color: Color,
    showLevel: Boolean,
    showCharging: Boolean,
    showTemp: Boolean
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.18f).coerceIn(13f, 28f).sp
        val adaptiveSubSize = (min(cw, ch) * 0.08f).coerceIn(8f, 13f).sp

        Box(contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val thickness = (min(cw, ch) * 0.09f).coerceIn(6f, 14f).dp.toPx()
                val halfStroke = thickness / 2f
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
                if (showLevel || value == null) {
                    Text(
                        text = if (value == null) "--" else "${value.toInt()}%",
                        color = color,
                        fontSize = adaptiveValueSize,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (showCharging || showTemp) {
                    Spacer(Modifier.height(3.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        if (showCharging) {
                            Text(text = "🔋", fontSize = adaptiveSubSize * 1.3f)
                        }
                        if (showTemp) {
                            Text(
                                text = formatTemp(widget, temperature),
                                color = Color.White.copy(alpha = 0.6f),
                                fontSize = adaptiveSubSize
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BarBattery(
    widget: BatteryWidget,
    value: Float?,
    temperature: Float?,
    ratio: Float,
    color: Color,
    showLevel: Boolean,
    showCharging: Boolean,
    showTemp: Boolean
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(10.dp),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val adaptiveValueSize = (min(cw, ch) * 0.16f).coerceIn(12f, 24f).sp
        val adaptiveSubSize = (min(cw, ch) * 0.07f).coerceIn(8f, 12f).sp
        val barHeight = (min(cw, ch) * 0.16f).coerceIn(14f, 28f).dp
        val capWidth = (barHeight.value * 0.22f).dp

        Column(
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (showLevel || showCharging || showTemp) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (showCharging) {
                        Text(text = "🔋", fontSize = adaptiveValueSize)
                    }
                    if (showLevel) {
                        Text(
                            text = if (value == null) "--" else "${value.toInt()}%",
                            color = color,
                            fontSize = adaptiveValueSize,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    if (showTemp) {
                        Text(
                            text = formatTemp(widget, temperature),
                            color = Color.White.copy(alpha = 0.6f),
                            fontSize = adaptiveSubSize
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .height(barHeight)
                        .width((cw * 0.82f).dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.White.copy(alpha = 0.12f))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(ratio.coerceIn(0f, 1f))
                            .height(barHeight)
                            .clip(RoundedCornerShape(4.dp))
                            .background(color)
                    )
                }
                Spacer(Modifier.width(1.dp))
                Box(
                    modifier = Modifier
                        .width(capWidth)
                        .height(barHeight * 0.5f)
                        .clip(RoundedCornerShape(topStart = 0.dp, topEnd = 2.dp, bottomEnd = 2.dp, bottomStart = 0.dp))
                        .background(Color.White.copy(alpha = 0.35f))
                )
            }
        }
    }
}

private fun formatLevel(value: Float?): String {
    if (value == null || !value.isFinite()) return "--"
    return if (value % 1f == 0f) value.toInt().toString() else String.format("%.1f", value)
}

/** temperature isn't pushed in widgetData yet; param kept for future use. */
private fun formatTemp(widget: BatteryWidget, temp: Float?): String {
    if (temp == null || !temp.isFinite()) return "--°C"
    return String.format("%.1f°C", temp)
}