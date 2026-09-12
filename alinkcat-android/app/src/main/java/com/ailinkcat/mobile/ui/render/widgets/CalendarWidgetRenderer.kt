package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.CalendarWidget
import com.ailinkcat.mobile.utils.ColorParser
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.util.Locale

/**
 * 日历控件：显示当月日历，支持高亮今天。
 */
@Composable
fun CalendarWidgetRenderer(
    widget: CalendarWidget,
    widgetData: Map<String, Float>
) {
    val background = ColorParser.parse(widget.backgroundColor, Color(0xFF1A1A2E))
    val textColor = ColorParser.parse(widget.textColor, Color.White)

    // 午夜 ticker：跨天自动刷新「今天」高亮与月份标题
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
    val currentMonth = YearMonth.from(today)
    val monthLabel = currentMonth.format(DateTimeFormatter.ofPattern("yyyy M", Locale.getDefault()))

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(background)
            .padding(6.dp)
    ) {
        val cw = maxWidth.value
        val headerSize = (cw * 0.055f).coerceIn(10f, 14f).sp
        val dateSize = (cw * 0.05f).coerceIn(9f, 13f).sp

        // 内容超高时纵向滚动（对齐 PC 端 overflow:auto）
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = monthLabel,
                color = textColor,
                fontSize = headerSize,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp)
            )

            // 星期行
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                val dayNames = listOf(
                    stringResource(R.string.sun_short),
                    stringResource(R.string.mon_short),
                    stringResource(R.string.tue_short),
                    stringResource(R.string.wed_short),
                    stringResource(R.string.thu_short),
                    stringResource(R.string.fri_short),
                    stringResource(R.string.sat_short)
                )
                dayNames.forEach { day ->
                    Text(
                        text = day,
                        color = textColor.copy(alpha = 0.6f),
                        fontSize = dateSize,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(Modifier.height(2.dp))

            // 日期网格
            val firstDay = currentMonth.atDay(1)
            val startDayOfWeek = firstDay.dayOfWeek.value % 7 // 0=Sun, 1=Mon, ...
            val daysInMonth = currentMonth.lengthOfMonth()

            val weeks = (0 until (startDayOfWeek + daysInMonth + 6) / 7)
            weeks.forEach { week ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    (0 until 7).forEach { dayOfWeek ->
                        val day = week * 7 + dayOfWeek - startDayOfWeek + 1
                        if (day in 1..daysInMonth) {
                            val isToday = day == today.dayOfMonth
                            Text(
                                text = day.toString(),
                                color = if (isToday) Color(0xFF4F6EF7) else textColor,
                                fontSize = dateSize,
                                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .weight(1f)
                                    .then(
                                        if (isToday) Modifier
                                            .clip(CircleShape)
                                            .background(Color.White.copy(alpha = 0.15f))
                                            .padding(vertical = 2.dp)
                                        else Modifier.padding(vertical = 2.dp)
                                    )
                            )
                        } else {
                            Text(
                                text = "",
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}
