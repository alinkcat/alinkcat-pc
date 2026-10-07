package com.ailinkcat.mobile.ui.render.layouts

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
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
 * Grid layout: columns x rows cells, widgets placed by gridRow/gridCol with
 * rowSpan/colSpan support; widgets without coordinates auto-fill
 * left-to-right, top-to-bottom. Portrait uses uniform square cells so the
 * grid doesn't stretch; landscape keeps the 1280x720 design ratio.
 */
@Composable
fun GridLayout(
    columns: Int,
    rows: Int?,
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

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        // tighter spacing in portrait leaves more room per cell
        val spacing: Dp = if (isLandscape) 8.dp else 5.dp
        val safeColumns = columns.coerceAtLeast(1)

        // remember: skip grid recomputation on high-frequency widgetData pushes
        data class Positioned(val row: Int, val col: Int, val widget: Widget)

        val positioned = remember(widgets, columns) {
            var autoRow = 0
            var autoCol = 0
            widgets.map { widget ->
                val pos = widget.layout
                if (pos.gridRow != null && pos.gridCol != null) {
                    val gc = pos.gridCol.coerceIn(0, safeColumns - 1)
                    val gr = pos.gridRow.coerceAtLeast(0)
                    Positioned(gr, gc, widget)
                } else {
                    val colSpan = (pos.colSpan ?: 1).coerceIn(1, safeColumns)
                    if (autoCol + colSpan > safeColumns) {
                        autoRow++
                        autoCol = 0
                    }
                    val result = Positioned(autoRow, autoCol, widget)
                    autoCol += colSpan
                    if (autoCol >= safeColumns) {
                        autoRow++
                        autoCol = 0
                    }
                    result
                }
            }
        }

        val computedRows = (rows ?: positioned.maxOfOrNull { p ->
            p.row + (p.widget.layout.rowSpan ?: 1).coerceAtLeast(1)
        }?.coerceAtLeast(1) ?: 1).coerceIn(1, 64)

        val rawCellWidth = ((maxWidth - spacing * (safeColumns + 1)) / safeColumns).coerceAtLeast(1.dp)
        val rawCellHeight = if (computedRows > 0) {
            ((maxHeight - spacing * (computedRows + 1)) / computedRows).coerceAtLeast(1.dp)
        } else {
            maxHeight
        }

        val useUniformCell = !isLandscape

        val cellWidth: Dp
        val cellHeight: Dp
        if (useUniformCell) {
            val uniform = minOf(rawCellWidth, rawCellHeight).coerceAtLeast(1.dp)
            cellWidth = uniform
            cellHeight = uniform
        } else {
            cellWidth = rawCellWidth
            cellHeight = rawCellHeight
        }

        val gridWidth = cellWidth * safeColumns + spacing * (safeColumns + 1)
        val gridHeight = cellHeight * computedRows + spacing * (computedRows + 1)
        val gridStartX = ((maxWidth - gridWidth) / 2f).coerceAtLeast(0.dp)
        val gridStartY = ((maxHeight - gridHeight) / 2f).coerceAtLeast(0.dp)

        positioned.forEach { (gridRow, gridCol, widget) ->
            // clamp spans to what's left of the grid, or a widget parked at col 2
            // with colSpan 4 paints two columns past the screen edge
            val rowSpan = (widget.layout.rowSpan ?: 1).coerceAtLeast(1)
                .coerceAtMost(((rows ?: Int.MAX_VALUE) - gridRow).coerceAtLeast(1))
            val colSpan = (widget.layout.colSpan ?: 1)
                .coerceIn(1, (safeColumns - gridCol).coerceAtLeast(1))
            val gc = gridCol.toFloat()
            val gr = gridRow.toFloat()
            val cs = colSpan.toFloat()
            val rs = rowSpan.toFloat()
            Box(
                modifier = Modifier
                    .offset(
                        x = gridStartX + spacing + (cellWidth + spacing) * gc,
                        y = gridStartY + spacing + (cellHeight + spacing) * gr
                    )
                    .size(
                        width = cellWidth * cs + spacing * (cs - 1f),
                        height = cellHeight * rs + spacing * (rs - 1f)
                    )
                    .clipToBounds()
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
