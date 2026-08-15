package com.ailinkcat.mobile.ui.render.layouts

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.Widget
import com.ailinkcat.mobile.ui.render.WidgetRenderer
import java.io.File

/**
 * 自由布局：
 * 1. PC 端字段 freeX/freeY/freeW/freeH：百分比 (0-100)，直接按父容器百分比定位。
 * 2. 兼容字段 x/y/width/height：设计像素坐标，按设计基准分辨率等比缩放：
 *    scaleX = actualWidth / DESIGN_WIDTH，scaleY = actualHeight / DESIGN_HEIGHT
 *    x = widget.x * scaleX，y = widget.y * scaleY，
 *    width = widget.width * scaleX，height = widget.height * scaleY。
 */
@Composable
fun FreeLayout(
    widgets: List<Widget>,
    themeId: String,
    themeDir: File,
    widgetData: Map<String, Float>,
    mediaState: MediaState,
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    if (widgets.isEmpty()) return

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val parentWidth = maxWidth
        val parentHeight = maxHeight

        // 设计基准缩放系数
        val scaleX = parentWidth.value / DesignCanvas.DESIGN_WIDTH
        val scaleY = parentHeight.value / DesignCanvas.DESIGN_HEIGHT

        widgets.forEach { widget ->
            val layout = widget.layout

            val xOffset: Dp
            val yOffset: Dp
            val wSize: Dp
            val hSize: Dp

            if (layout.freeX != null || layout.freeY != null ||
                layout.freeW != null || layout.freeH != null
            ) {
                // PC 百分比坐标 (0-100)
                xOffset = parentWidth * ((layout.freeX ?: 0f) / 100f)
                yOffset = parentHeight * ((layout.freeY ?: 0f) / 100f)
                wSize = parentWidth * ((layout.freeW ?: 20f) / 100f)
                hSize = parentHeight * ((layout.freeH ?: 20f) / 100f)
            } else {
                // 设计像素坐标：按实际/设计基准等比缩放
                xOffset = ((layout.x ?: 0f) * scaleX).dp
                yOffset = ((layout.y ?: 0f) * scaleY).dp
                wSize = ((layout.width ?: 0f) * scaleX).dp
                hSize = ((layout.height ?: 0f) * scaleY).dp
            }

            Box(
                modifier = Modifier
                    .offset(
                        x = xOffset,
                        y = yOffset
                    )
                    .size(
                        width = wSize,
                        height = hSize
                    )
            ) {
                WidgetRenderer(
                    widget = widget,
                    themeId = themeId,
                    themeDir = themeDir,
                    widgetData = widgetData,
                    mediaState = mediaState,
                    onButtonClick = onButtonClick,
                    onSnippetClick = onSnippetClick
                )
            }
        }
    }
}
