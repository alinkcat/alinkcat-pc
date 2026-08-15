package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.ButtonWidget
import com.ailinkcat.mobile.ui.render.parseFontWeight
import com.ailinkcat.mobile.utils.ColorParser

/**
 * 按钮控件：图标 + 标签，点击触发 action.execute。
 * 文字/图标大小随控件容器等比缩放。
 */
@Composable
fun ButtonWidgetRenderer(
    widget: ButtonWidget,
    onClick: () -> Unit
) {
    val background = ColorParser.withOpacity(
        ColorParser.parse(widget.backgroundColor, MaterialTheme.colorScheme.primary),
        widget.backgroundOpacity
    )
    val foreground = ColorParser.parse(widget.textColor, Color.White)
    val radius = (widget.borderRadius ?: 12).dp

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(radius))
            .background(background)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        val cw = maxWidth.value
        val adaptiveFontSize = widget.fontSize?.sp ?: (cw * 0.08f).coerceIn(10f, 32f).sp
        val adaptiveIconSize = (cw * 0.15f).coerceIn(14f, 48f).sp

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            widget.icon?.let {
                Text(it, fontSize = adaptiveIconSize)
                Spacer(Modifier.height((cw * 0.02f).coerceIn(2f, 8f).dp))
            }
            Text(
                text = widget.label,
                color = foreground,
                fontSize = adaptiveFontSize,
                fontWeight = parseFontWeight(widget.fontWeight),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
