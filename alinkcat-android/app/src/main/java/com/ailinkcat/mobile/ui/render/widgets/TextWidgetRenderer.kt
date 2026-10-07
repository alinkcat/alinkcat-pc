package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import kotlin.math.min

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
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(6.dp)
            .then(if (hasClick) Modifier.clickable { onClick(action!!) } else Modifier)
    ) {
        val edge = min(maxWidth.value, maxHeight.value)
        Text(
            text = widget.text,
            color = ColorParser.parse(widget.textColor, Color.White),
            fontSize = adaptiveSp(edge, widget.fontSize, 20f, 9f, 64f),
            fontWeight = parseFontWeight(widget.fontWeight),
            textAlign = align,
            modifier = Modifier.fillMaxSize()
        )
    }
}

