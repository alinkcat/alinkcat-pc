package com.ailinkcat.mobile.ui.render.layouts

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
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
 * 2. 兼容字段 x/y/width/height：设计像素坐标，按设计基准分辨率等比缩放。
 *
 * 横竖屏适配：
 * - 百分比坐标已天然适配屏幕比例（freeX = parentWidth * x / 100）。
 * - 设计像素坐标使用【统一缩放系数】= min(scaleX, scaleY)：
 *   保证整个设计画布内容完整可见、控件保持宽高比，不会因 scaleX != scaleY
 *   在横竖屏切换时被拉伸变形。
 * - 设计画布在屏幕上居中对齐：当画布尺寸小于屏幕时（竖屏显示横屏画布），
 *   自动在空白侧留白居中，实现"整体容纳、居中展示"，组件相对位置不跑偏。
 */
@Composable
fun FreeLayout(
    widgets: List<Widget>,
    themeId: String,
    themeDir: File,
    widgetData: Map<String, Float>,
    mediaState: MediaState,
    isLandscape: Boolean = true,
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    if (widgets.isEmpty()) return

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clipToBounds() // 超出画布的控件裁剪掉
    ) {
        val parentWidth = maxWidth
        val parentHeight = maxHeight

        // 缩放取宽高较小者，等比不变形
        val scaleX = parentWidth.value / DesignCanvas.DESIGN_WIDTH
        val scaleY = parentHeight.value / DesignCanvas.DESIGN_HEIGHT
        val uniformScale = minOf(scaleX, scaleY)

        // 设计画布换算到屏幕后的实际尺寸
        val canvasWidthPx = DesignCanvas.DESIGN_WIDTH * uniformScale
        val canvasHeightPx = DesignCanvas.DESIGN_HEIGHT * uniformScale

        // 画布在屏幕上的居中偏移（竖屏/宽屏时自动居中）
        val xPadding = if (parentWidth.value > canvasWidthPx) {
            (parentWidth.value - canvasWidthPx) / 2f
        } else 0f
        val yPadding = if (parentHeight.value > canvasHeightPx) {
            (parentHeight.value - canvasHeightPx) / 2f
        } else 0f
        val baseOffset = xPadding.dp to yPadding.dp

        widgets.forEach { widget ->
            val layout = widget.layout

            val xOffset: Dp
            val yOffset: Dp
            val wSize: Dp
            val hSize: Dp

            if (layout.freeX != null || layout.freeY != null ||
                layout.freeW != null || layout.freeH != null
            ) {
                // 百分比坐标 (0-100)，叠加画布居中偏移 baseOffset，与设计像素控件混用时相对位置一致
                xOffset = baseOffset.first + parentWidth * ((layout.freeX ?: 0f) / 100f)
                yOffset = baseOffset.second + parentHeight * ((layout.freeY ?: 0f) / 100f)
                wSize = parentWidth * ((layout.freeW ?: 20f) / 100f)
                hSize = parentHeight * ((layout.freeH ?: 20f) / 100f)
            } else {
                // 设计像素坐标：统一缩放 + 画布居中
                // 尺寸缺失时默认画布 20%，避免静默 0 尺寸
                xOffset = baseOffset.first + ((layout.x ?: 0f) * uniformScale).dp
                yOffset = baseOffset.second + ((layout.y ?: 0f) * uniformScale).dp
                wSize = ((layout.width ?: DesignCanvas.DESIGN_WIDTH * 0.2f) * uniformScale).dp
                hSize = ((layout.height ?: DesignCanvas.DESIGN_HEIGHT * 0.2f) * uniformScale).dp
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
