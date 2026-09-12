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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.DateWidget
import com.ailinkcat.mobile.utils.LunarCalendar
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * 日期组件：公历日期 + 星期，可选农历。
 */
@Composable
fun DateWidgetRenderer(widget: DateWidget) {
    // 午夜 ticker：跨天自动刷新日期/星期/农历
    var today by remember { mutableStateOf(LocalDate.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            val now = java.time.LocalDateTime.now()
            val nextMidnight = now.toLocalDate().plusDays(1).atStartOfDay()
            kotlinx.coroutines.delay(
                java.time.Duration.between(now, nextMidnight).toMillis().coerceAtLeast(1_000L)
            )
            today = LocalDate.now()
        }
    }

    val dateStr = today.format(DateTimeFormatter.ofPattern("yyyy M d", Locale.getDefault()))
    val weekStr = today.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())

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
                text = dateStr,
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = weekStr,
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 14.sp
            )
            if (widget.showLunar) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = getLunarDateString(today),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
    }
}

/**
 * 农历日期计算，基于查表法，支持 1900-2100 年。
 */
private fun getLunarDateString(date: LocalDate): String {
    return LunarCalendar.solarToLunar(date)
}
