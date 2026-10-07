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
 * Free layout. freeX/freeY/freeW/freeH are percentages; legacy x/y/width/height
 * are design pixels scaled by min(scaleX, scaleY) so widgets keep their aspect
 * ratio across orientations, with the canvas centered in the leftover space.
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
            .clipToBounds()
    ) {
        val parentWidth = maxWidth
        val parentHeight = maxHeight

        val scaleX = parentWidth.value / DesignCanvas.DESIGN_WIDTH
        val scaleY = parentHeight.value / DesignCanvas.DESIGN_HEIGHT
        val uniformScale = minOf(scaleX, scaleY)

        val canvasWidthPx = DesignCanvas.DESIGN_WIDTH * uniformScale
        val canvasHeightPx = DesignCanvas.DESIGN_HEIGHT * uniformScale

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
                // percentages + baseOffset so widgets from both coordinate
                // systems keep the same relative positions; clamp to the
                // canvas so a bad theme can't paint past the screen edge
                val px = (layout.freeX ?: 0f).coerceIn(0f, 100f)
                val py = (layout.freeY ?: 0f).coerceIn(0f, 100f)
                xOffset = baseOffset.first + parentWidth * (px / 100f)
                yOffset = baseOffset.second + parentHeight * (py / 100f)
                wSize = parentWidth * ((layout.freeW ?: 20f).coerceIn(0f, 100f - px) / 100f)
                hSize = parentHeight * ((layout.freeH ?: 20f).coerceIn(0f, 100f - py) / 100f)
            } else {
                // design pixels; a missing size defaults to 20% of the canvas
                // instead of silently rendering at 0
                val px = (layout.x ?: 0f).coerceIn(0f, DesignCanvas.DESIGN_WIDTH)
                val py = (layout.y ?: 0f).coerceIn(0f, DesignCanvas.DESIGN_HEIGHT)
                xOffset = baseOffset.first + (px * uniformScale).dp
                yOffset = baseOffset.second + (py * uniformScale).dp
                wSize = ((layout.width ?: DesignCanvas.DESIGN_WIDTH * 0.2f)
                    .coerceIn(0f, DesignCanvas.DESIGN_WIDTH - px) * uniformScale).dp
                hSize = ((layout.height ?: DesignCanvas.DESIGN_HEIGHT * 0.2f)
                    .coerceIn(0f, DesignCanvas.DESIGN_HEIGHT - py) * uniformScale).dp
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
