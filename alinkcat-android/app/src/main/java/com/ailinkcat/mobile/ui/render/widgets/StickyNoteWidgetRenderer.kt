package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.StickyNoteWidget
import androidx.compose.ui.res.stringResource
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.utils.ColorParser

/**
 * 便签控件：标题 + 垂直列表显示条目，点击条目触发文本输入到 PC。
 * 文字大小随容器等比缩放，内容可滚动。
 */
@Composable
fun StickyNoteWidgetRenderer(
    widget: StickyNoteWidget,
    onSnippetClick: (String) -> Unit
) {
    val background = ColorParser.parse(widget.backgroundColor, Color(0xFFFFF3CD))
    val textColor = ColorParser.parse(widget.textColor, Color(0xFF5A4A00))

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(background)
            .padding(8.dp)
    ) {
        val cw = maxWidth.value
        val adaptiveTitleSize = (cw * 0.08f).coerceIn(12f, 18f).sp
        val adaptiveLabelSize = (cw * 0.06f).coerceIn(9f, 14f).sp
        val adaptiveContentSize = (cw * 0.055f).coerceIn(9f, 13f).sp
        val adaptiveLabelWidth = (cw * 0.28f).coerceIn(40f, 80f).dp

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = widget.label,
                color = textColor,
                fontSize = adaptiveTitleSize,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(textColor.copy(alpha = 0.2f))
            )

            // 便签条目
            widget.notes.forEach { note ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color.White.copy(alpha = 0.65f))
                        .clickable { onSnippetClick(note.content) }
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = note.label,
                        color = textColor,
                        fontSize = adaptiveLabelSize,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.width(adaptiveLabelWidth),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = note.content,
                        color = textColor,
                        fontSize = adaptiveContentSize,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
            if (widget.notes.isEmpty()) {
                Text(
                    text = stringResource(R.string.no_notes),
                    color = textColor.copy(alpha = 0.6f),
                    fontSize = adaptiveContentSize
                )
            }
        }
    }
}