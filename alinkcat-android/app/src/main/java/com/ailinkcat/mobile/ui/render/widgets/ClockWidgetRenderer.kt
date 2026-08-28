package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.ClockWidget
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import kotlin.math.cos
import kotlin.math.sin

/**
 * 时钟组件：支持数字时钟和模拟时钟两种模式。
 * 数字时钟保留原有逻辑，模拟时钟用 Compose Canvas 绘制。
 */
@Composable
fun ClockWidgetRenderer(widget: ClockWidget) {
    if (widget.clockDisplay == "analog") {
        AnalogClockContent(widget)
    } else {
        DigitalClockContent(widget)
    }
}

// ─── Digital clock (existing) ─────────────────────────────────

@Composable
private fun DigitalClockContent(widget: ClockWidget) {
    var timeText by remember { mutableStateOf("") }
    var weekText by remember { mutableStateOf("") }
    val intervalMs = if (widget.showSeconds) 1000L else 60_000L
    LaunchedEffect(Unit) {
        while (true) {
            val now = LocalTime.now()
            val formatter = DateTimeFormatter.ofPattern(
                if (widget.format24h) {
                    if (widget.showSeconds) "HH:mm:ss" else "HH:mm"
                } else {
                    if (widget.showSeconds) "hh:mm:ss a" else "hh:mm a"
                }
            )
            timeText = now.format(formatter)
            if (widget.showWeekday) {
                weekText = java.time.LocalDate.now().dayOfWeek
                    .getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.getDefault())
            }
            kotlinx.coroutines.delay(intervalMs)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(listOf(Color(0xCC1A1A2E), Color(0xCC2A1A3A)))
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = timeText,
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            if (widget.showWeekday) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = weekText,
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            if (widget.label.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
    }
}

// ─── Analog clock ─────────────────────────────────────────────

private fun parseColor(hex: String): Color {
    return try {
        Color(android.graphics.Color.parseColor(hex))
    } catch (_: Exception) {
        Color.White
    }
}

@Composable
private fun AnalogClockContent(widget: ClockWidget) {
    var now by remember { mutableStateOf(LocalTime.now()) }

    LaunchedEffect(Unit) {
        while (true) {
            now = LocalTime.now()
            kotlinx.coroutines.delay(250L) // smooth second hand
        }
    }

    val faceColor = remember(widget.faceColor) { parseColor(widget.faceColor) }
    val handColor = remember(widget.handColor) { parseColor(widget.handColor) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val radius = minOf(cx, cy) - 4f

            // ── Face circle ──
            drawCircle(
                color = faceColor,
                radius = radius,
                center = Offset(cx, cy)
            )
            drawCircle(
                color = handColor,
                radius = radius,
                center = Offset(cx, cy),
                style = Stroke(width = 2f)
            )

            // ── Tick marks ──
            if (widget.tickMarks) {
                for (i in 0 until 12) {
                    val angle = Math.toRadians((i * 30 - 90).toDouble())
                    val inner = radius * 0.85f
                    val outer = radius * 0.93f
                    val lineWidth = if (i % 3 == 0) 3f else 1.5f
                    drawLine(
                        color = handColor,
                        start = Offset(
                            cx + (cos(angle) * inner).toFloat(),
                            cy + (sin(angle) * inner).toFloat()
                        ),
                        end = Offset(
                            cx + (cos(angle) * outer).toFloat(),
                            cy + (sin(angle) * outer).toFloat()
                        ),
                        strokeWidth = lineWidth
                    )
                }
            }

            // ── Numbers (12, 3, 6, 9) ──
            if (widget.showNumbers) {
                drawContext.canvas.nativeCanvas.apply {
                    val paint = android.graphics.Paint().apply {
                        color = handColor.toArgb()
                        textAlign = android.graphics.Paint.Align.CENTER
                        textSize = radius * 0.16f
                        isFakeBoldText = true
                        isAntiAlias = true
                    }
                    val numRadius = radius * 0.75f
                    val numbers = listOf(12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
                    for (i in 0 until 12) {
                        val angle = Math.toRadians((i * 30 - 90).toDouble())
                        val nx = cx + (cos(angle) * numRadius).toFloat()
                        val ny = cy + (sin(angle) * numRadius).toFloat()
                        // Adjust text baseline for vertical centering
                        val fontMetrics = paint.fontMetrics
                        val textY = ny - (fontMetrics.ascent + fontMetrics.descent) / 2f
                        drawText(numbers[i].toString(), nx, textY, paint)
                    }
                }
            }

            // ── Compute hand angles ──
            val hours = now.hour % 12
            val minutes = now.minute
            val seconds = now.second

            // Hour angle: 360° / 12h = 30° per hour + minute contribution
            val hourAngle = Math.toRadians((hours * 30 + minutes * 0.5 - 90).toDouble())
            // Minute angle: 360° / 60min = 6° per minute + second contribution
            val minuteAngle = Math.toRadians((minutes * 6 + seconds * 0.1 - 90).toDouble())
            // Second angle: 360° / 60s = 6° per second
            val secondAngle = Math.toRadians((seconds * 6 - 90).toDouble())

            // ── Hour hand ──
            val hhLen = radius * 0.5f
            val hhThick = getHandThickness(handStyle = widget.handStyle, base = 4f)
            drawLine(
                color = handColor,
                start = Offset(cx, cy),
                end = Offset(
                    cx + (cos(hourAngle) * hhLen).toFloat(),
                    cy + (sin(hourAngle) * hhLen).toFloat()
                ),
                strokeWidth = hhThick,
                cap = StrokeCap.Round
            )

            // ── Minute hand ──
            val mhLen = radius * 0.7f
            val mhThick = getHandThickness(handStyle = widget.handStyle, base = 3f)
            drawLine(
                color = handColor,
                start = Offset(cx, cy),
                end = Offset(
                    cx + (cos(minuteAngle) * mhLen).toFloat(),
                    cy + (sin(minuteAngle) * mhLen).toFloat()
                ),
                strokeWidth = mhThick,
                cap = StrokeCap.Round
            )

            // ── Second hand ──
            val shLen = radius * 0.8f
            val shThick = getHandThickness(handStyle = widget.handStyle, base = 1.5f)
            val secondColor = Color(0xFFFF4444)
            drawLine(
                color = secondColor,
                start = Offset(cx, cy),
                end = Offset(
                    cx + (cos(secondAngle) * shLen).toFloat(),
                    cy + (sin(secondAngle) * shLen).toFloat()
                ),
                strokeWidth = shThick,
                cap = StrokeCap.Round
            )

            // ── Center dot ──
            drawCircle(color = handColor, radius = 4f, center = Offset(cx, cy))
            drawCircle(color = secondColor, radius = 2f, center = Offset(cx, cy))
        }
    }
}

private fun getHandThickness(handStyle: String, base: Float): Float {
    return when (handStyle) {
        "modern" -> base * 1.5f
        "thin" -> base * 0.5f
        else -> base
    }
}