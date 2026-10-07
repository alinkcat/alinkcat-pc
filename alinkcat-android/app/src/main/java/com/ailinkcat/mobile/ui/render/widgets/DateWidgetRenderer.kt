package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import kotlin.math.min
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.DateWidget
import com.ailinkcat.mobile.utils.LunarCalendar
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun DateWidgetRenderer(widget: DateWidget) {
    // midnight ticker so the date rolls over without a restart
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

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(
                Brush.linearGradient(listOf(Color(0xCC1A1A2E), Color(0xCC2A1A3A)))
            ),
        contentAlignment = Alignment.Center
    ) {
        val edge = min(maxWidth.value, maxHeight.value)
        val dateSize = adaptiveSp(edge, null, 20f, 11f, 56f)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = dateStr,
                color = Color.White,
                fontSize = dateSize,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = weekStr,
                color = Color.White.copy(alpha = 0.7f),
                fontSize = (dateSize.value * 0.7f).coerceAtLeast(9f).sp
            )
            if (widget.showLunar) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = getLunarDateString(today),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = (dateSize.value * 0.6f).coerceAtLeast(9f).sp
                )
            }
        }
    }
}

private fun getLunarDateString(date: LocalDate): String {
    return LunarCalendar.solarToLunar(date)
}
