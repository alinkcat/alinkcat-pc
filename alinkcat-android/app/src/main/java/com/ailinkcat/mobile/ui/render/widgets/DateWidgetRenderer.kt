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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.DateWidget
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/**
 * 日期组件：公历日期 + 星期，可选农历。
 */
@Composable
fun DateWidgetRenderer(widget: DateWidget) {
    val now = LocalDate.now()
    val dateStr = now.format(DateTimeFormatter.ofPattern("yyyy M d", Locale.getDefault()))
    val weekStr = now.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.getDefault())

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
                    text = getLunarDateString(now),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
    }
}

/**
 * 农历日期映射（2026 年做参考）。
 *
 * TODO: 替换为完整的农历计算工具类。
 *   当前硬编码的农历映射仅覆盖 2026 年部分日期，无法正确处理：
 *   - 2027 年及以后的农历日期
 *   - 闰月（2026 年无闰月，但其他年份有）
 *   建议方案：
 *   1. 引入第三方农历库（如 cn.jpush:androidutils 或 com.derzhang:lunar-calendar）
 *   2. 或实现基于查表法的 LunarCalendar 工具类（需要 1900-2100 年农历数据表）
 *   3. 降级方案：当 key 不在 map 中时返回空字符串而非 "Lunar"
 */
private fun getLunarDateString(date: LocalDate): String {
    val key = date.toString()
    val lunarMap = mapOf(
        "2026-01-01" to "Lunar 12/3", "2026-01-10" to "Lunar 12/12",
        "2026-01-28" to "Lunar 12/30", "2026-01-29" to "Lunar 1/1",
        "2026-02-12" to "Lunar 1/15", "2026-02-14" to "Lunar 1/17",
        "2026-02-28" to "Lunar 2/1", "2026-03-14" to "Lunar 2/15",
        "2026-03-31" to "Lunar 3/1", "2026-04-14" to "Lunar 3/15",
        "2026-04-30" to "Lunar 4/1", "2026-05-14" to "Lunar 4/15",
        "2026-05-31" to "Lunar 5/1", "2026-06-14" to "Lunar 5/15",
        "2026-06-25" to "Lunar 5/6", "2026-06-30" to "Lunar 5/11",
        "2026-07-01" to "Lunar 5/12", "2026-07-31" to "Lunar 6/1",
        "2026-08-04" to "Lunar 6/5", "2026-08-14" to "Lunar 6/15",
        "2026-08-31" to "Lunar 7/1", "2026-09-14" to "Lunar 7/15",
        "2026-09-30" to "Lunar 8/1", "2026-10-14" to "Lunar 8/15",
        "2026-10-31" to "Lunar 9/1", "2026-11-14" to "Lunar 9/15",
        "2026-11-30" to "Lunar 10/1", "2026-12-14" to "Lunar 10/15",
        "2026-12-31" to "Lunar 11/1"
    )
    return lunarMap[key] ?: "Lunar"
}
