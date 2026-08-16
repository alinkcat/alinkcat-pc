package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.ImageWidget
import java.io.File

/**
 * 图片控件：从主题包目录加载本地图片（Coil），支持 cover/contain/stretch 缩放与圆角。支持点击动作。
 */
@Composable
fun ImageWidgetRenderer(
    widget: ImageWidget,
    baseDir: File,
    onClick: (Action) -> Unit = {}
) {
    val model = remember(widget.imagePath) {
        widget.imagePath?.takeIf { it.isNotBlank() && !it.startsWith("data:") }?.let {
            File(baseDir, it)
        }
    }

    val scale = when (widget.scaleMode?.lowercase()) {
        "contain" -> ContentScale.Fit
        "stretch", "fill" -> ContentScale.FillBounds
        else -> ContentScale.Crop
    }
    val radius = (widget.borderRadius ?: 0).dp

    val action = widget.clickAction
    val hasClick = action != null && action.type != "none"

    if (model != null) {
        AsyncImage(
            model = model,
            contentDescription = null,
            contentScale = scale,
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(radius))
                .then(if (hasClick) Modifier.clickable { onClick(action!!) } else Modifier)
        )
    } else {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(radius))
                .background(Color(0xFF333333))
                .then(if (hasClick) Modifier.clickable { onClick(action!!) } else Modifier),
            contentAlignment = Alignment.Center
        ) {
            Text("🖼️", fontSize = 28.sp)
        }
    }
}
