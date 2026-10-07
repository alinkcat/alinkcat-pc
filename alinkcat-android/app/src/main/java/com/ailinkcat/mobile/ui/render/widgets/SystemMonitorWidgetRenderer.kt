package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import kotlin.math.min
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.SystemMonitorWidget
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import com.ailinkcat.mobile.utils.FileUtils

/**
 * System monitor widget: CPU / memory / disk / network cards. Data comes from
 * the monitor.data push; several key spellings are accepted per metric.
 */
@Composable
fun SystemMonitorWidgetRenderer(
    widget: SystemMonitorWidget,
    widgetData: Map<String, Float>,
    onClick: (Action) -> Unit = {}
) {
    // first key that has data wins
    fun v(keys: List<String>): Float? = keys.firstNotNullOfOrNull { widgetData[it] }

    val clickAction = widget.clickAction
    val hasClick = clickAction != null && clickAction.type != "none"
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xCC1A1A2E))
            .padding(10.dp)
            .then(if (hasClick) Modifier.clickable { onClick(clickAction!!) } else Modifier)
    ) {
        // fonts scale with the cell: 50dp cell -> label 13sp; smaller -> shrink
        val labelSize = adaptiveSp(min(maxWidth.value, maxHeight.value), null, 13f, 9f, 18f)
        val rowSize = (labelSize.value * 0.92f).coerceAtLeast(8f).sp
        val smallSize = (labelSize.value * 0.77f).coerceAtLeast(7f).sp
        val speedSize = (labelSize.value * 1.08f).coerceAtLeast(9f).sp
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (widget.label.isNotBlank()) {
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = labelSize,
                    fontWeight = FontWeight.Medium
                )
                Spacer(Modifier.height(2.dp))
            }

            if (widget.showCpu) {
                val cpu = v(listOf("cpu", "cpuUsage"))
                MetricRow(
                    label = stringResource(R.string.cpu),
                    value = cpu,
                    suffix = "%",
                    color = pickColor(cpu, 50f, 80f),
                    labelSize = labelSize, valueSize = rowSize
                )
            }
            if (widget.showMemory) {
                val mem = v(listOf("memory", "memoryUsage", "mem"))
                MetricRow(
                    label = stringResource(R.string.memory),
                    value = mem,
                    suffix = "%",
                    color = pickColor(mem, 60f, 85f),
                    labelSize = labelSize, valueSize = rowSize
                )
            }
            if (widget.showDisk) {
                val disk = v(listOf("disk", "diskUsage"))
                MetricRow(
                    label = stringResource(R.string.disk),
                    value = disk,
                    suffix = "%",
                    color = pickColor(disk, 70f, 90f),
                    labelSize = labelSize, valueSize = rowSize
                )
            }
            if (widget.showNetwork) {
                val up = v(listOf("network.upload", "uploadSpeed", "net_up"))
                val down = v(listOf("network.download", "downloadSpeed", "net_down"))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MetricSmall(
                        label = stringResource(R.string.upload),
                        value = up,
                        suffix = "B/s",
                        color = Color(0xFF4F6EF7),
                        labelSize = smallSize, valueSize = speedSize
                    )
                    MetricSmall(
                        label = stringResource(R.string.download),
                        value = down,
                        suffix = "B/s",
                        color = Color(0xFF34C759),
                        labelSize = smallSize, valueSize = speedSize
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricRow(
    label: String,
    value: Float?,
    suffix: String,
    color: Color,
    labelSize: TextUnit,
    valueSize: TextUnit
) {
    val animatedValue by animateFloatAsState(
        targetValue = (value ?: 0f) / 100f,
        animationSpec = tween(500),
        label = label
    )
    val displayText = if (value != null) {
        "%.1f%s".format(value, suffix)
    } else {
        "-- $suffix"
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = Color.White.copy(alpha = 0.8f),
                fontSize = valueSize,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = displayText,
                color = color,
                fontSize = valueSize,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(5.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Color.White.copy(alpha = 0.10f))
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(animatedValue.coerceIn(0f, 1f))
                    .height(5.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(color)
            )
        }
    }
}

@Composable
private fun MetricSmall(
    label: String,
    value: Float?,
    suffix: String,
    color: Color,
    labelSize: TextUnit,
    valueSize: TextUnit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            color = Color.White.copy(alpha = 0.6f),
            fontSize = labelSize
        )
        Text(
            text = formatNetworkSpeed(value),
            color = color,
            fontSize = valueSize,
            fontWeight = FontWeight.Bold
        )
    }
}

private fun pickColor(value: Float?, warn: Float, crit: Float): Color {
    if (value == null) return Color.Gray
    return when {
        value >= crit -> ErrorRed
        value >= warn -> WarningOrange
        else -> SuccessGreen
    }
}

private fun formatNetworkSpeed(bytesPerSec: Float?): String {
    if (bytesPerSec == null) return "--"
    return FileUtils.formatSpeed(bytesPerSec / 1024f)
}
