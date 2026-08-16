package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.clickable
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
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.TextWidget
import com.ailinkcat.mobile.ui.render.parseFontWeight
import com.ailinkcat.mobile.utils.ColorParser

/**
 * 文本控件：颜色、大小、字重、对齐。支持点击动作。
 */
@Composable
fun TextWidgetRenderer(
    widget: TextWidget,
    onClick: (Action) -> Unit = {}
) {
    val align = when (widget.textAlign?.lowercase()) {
        "center" -> TextAlign.Center
        "end", "right" -> TextAlign.End
        else -> TextAlign.Start
    }
    val action = widget.clickAction
    val hasClick = action != null && action.type != "none"
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
            .then(if (hasClick) Modifier.clickable { onClick(action!!) } else Modifier)
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
