package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.TextWidget
import com.ailinkcat.mobile.ui.render.parseFontWeight
import com.ailinkcat.mobile.utils.ColorParser

/**
 * 文本控件：颜色、大小、字重、对齐。
 */
@Composable
fun TextWidgetRenderer(widget: TextWidget) {
    val align = when (widget.textAlign?.lowercase()) {
        "center" -> TextAlign.Center
        "end", "right" -> TextAlign.End
        else -> TextAlign.Start
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
    ) {
        Text(
            text = widget.text,
            color = ColorParser.parse(widget.textColor, Color.White),
            fontSize = (widget.fontSize ?: 20).sp,
            fontWeight = parseFontWeight(widget.fontWeight),
            textAlign = align,
            modifier = Modifier.fillMaxSize()
        )
    }
}
