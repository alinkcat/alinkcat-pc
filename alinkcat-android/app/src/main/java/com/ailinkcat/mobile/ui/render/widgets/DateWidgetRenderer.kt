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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.DateWidget
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * 日期组件：公历日期 + 星期，可选农历。
 */
@Composable
fun DateWidgetRenderer(widget: DateWidget) {
    val now = LocalDate.now()
    val dateStr = now.format(DateTimeFormatter.ofPattern("yyyy 年 M 月 d 日", Locale.CHINESE))
    val weekStr = when (now.dayOfWeek.value) {
        1 -> "星期一"; 2 -> "星期二"; 3 -> "星期三"; 4 -> "星期四"
        5 -> "星期五"; 6 -> "星期六"; 7 -> "星期日"
        else -> ""
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
                Spacer(Modifier.height(2.dp))
                Text(
                    text = lunarDate(now),
                    color = Color(0xFFFFD700).copy(alpha = 0.8f),
                    fontSize = 12.sp
                )
            }
            if (widget.label.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 10.sp
                )
            }
        }
    }
}

private fun lunarDate(date: LocalDate): String {
    // Simplified lunar lookup for 2026
    val lunarMap = mapOf(
        "2026-01-01" to "腊月初三", "2026-01-10" to "腊月十二",
        "2026-01-28" to "腊月三十", "2026-01-29" to "正月初一",
        "2026-02-12" to "正月十五", "2026-02-14" to "正月十七",
        "2026-02-28" to "二月初一", "2026-03-14" to "二月十五",
        "2026-03-31" to "三月初一", "2026-04-14" to "三月十五",
        "2026-04-30" to "四月初一", "2026-05-14" to "四月十五",
        "2026-05-31" to "五月初一", "2026-06-14" to "五月十五",
        "2026-06-25" to "五月初六", "2026-06-30" to "五月十一",
        "2026-07-01" to "五月十二", "2026-07-31" to "六月初一",
        "2026-08-04" to "六月初五", "2026-08-14" to "六月十五",
        "2026-08-31" to "七月初一", "2026-09-14" to "七月十五",
        "2026-09-30" to "八月初一", "2026-10-14" to "八月十五",
        "2026-10-31" to "九月初一", "2026-11-14" to "九月十五",
        "2026-11-30" to "十月初一", "2026-12-14" to "十月十五",
        "2026-12-31" to "十一月初一"
    )
    val key = date.toString().take(10)
    return lunarMap[key] ?: "农历"
}