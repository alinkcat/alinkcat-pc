package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.ClockWidget
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * 时钟组件：按 format24h / showSeconds 格式化，每秒刷新。
 */
@Composable
fun ClockWidgetRenderer(widget: ClockWidget) {
    var timeText by remember { mutableStateOf("") }
    var intervalMs = if (widget.showSeconds) 1000L else 60_000L
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