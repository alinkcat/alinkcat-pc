package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.CalendarWidget
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * 日历组件：迷你月历网格，支持上下滑动切换月份，当前日期高亮。
 */
@Composable
fun CalendarWidgetRenderer(widget: CalendarWidget) {
    val today = LocalDate.now()
    var currentMonth by remember { mutableStateOf(YearMonth.from(today)) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.linearGradient(listOf(Color(0xCC1A1A2E), Color(0xCC2A1A3A)))
            )
            .padding(8.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().wrapContentHeight()) {
            // 月份标题（可点击切换）
            val monthLabel = currentMonth.format(DateTimeFormatter.ofPattern("yyyy 年 M 月", Locale.CHINESE))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("◀", fontSize = 14.sp, color = Color.White.copy(0.5f),
                    modifier = Modifier.clickable { currentMonth = currentMonth.minusMonths(1) })
                Text(
                    text = monthLabel,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text("▶", fontSize = 14.sp, color = Color.White.copy(0.5f),
                    modifier = Modifier.clickable { currentMonth = currentMonth.plusMonths(1) })
            }
            Spacer(Modifier.height(6.dp))

            // 星期行
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("一", "二", "三", "四", "五", "六", "日").forEach { day ->
                    Text(
                        text = day,
                        color = Color.White.copy(alpha = 0.4f),
                        fontSize = 10.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            Spacer(Modifier.height(4.dp))

            // 日期网格
            val firstDayOfWeek = currentMonth.atDay(1).dayOfWeek.value % 7 // Monday=0...Sunday=6
            val daysInMonth = currentMonth.lengthOfMonth()
            val totalCells = firstDayOfWeek + daysInMonth
            val rows = (totalCells + 6) / 7

            for (row in 0 until rows) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    for (col in 0..6) {
                        val cellIndex = row * 7 + col
                        val day = cellIndex - firstDayOfWeek + 1
                        val isToday = currentMonth.atDay(day.coerceIn(1, daysInMonth)) == today && day in 1..daysInMonth
                        if (day in 1..daysInMonth) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .then(
                                        if (isToday) Modifier
                                            .clip(CircleShape)
                                            .background(Color(0xFF4F6EF7))
                                        else Modifier
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "$day",
                                    color = if (isToday) Color.White
                                            else if (col >= 5) Color(0xFF4F6EF7).copy(0.6f)
                                            else Color.White.copy(0.7f),
                                    fontSize = 10.sp,
                                    fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        } else {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            if (widget.label.isNotBlank()) {
                Spacer(Modifier.weight(1f))
                Text(
                    text = widget.label,
                    color = Color.White.copy(0.3f),
                    fontSize = 9.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
        }
    }
}