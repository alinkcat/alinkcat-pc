package com.ailinkcat.mobile.ui.render.layouts

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.Widget
import com.ailinkcat.mobile.ui.render.WidgetRenderer
import java.io.File

/**
 * 网格布局：按 columns×rows 切分单元格，控件按 gridRow/gridCol 定位、rowSpan/colSpan 跨格。
 * 无显式坐标的控件按顺序从左到右、从上到下自动填充。
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
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    if (widgets.isEmpty()) return

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val spacing = 8.dp
        val cellWidth = (maxWidth - spacing * (columns + 1)) / columns

        // 先计算每个控件的实际网格位置（自动填充 + 显式定位）
        var autoRow = 0
        var autoCol = 0
        data class Positioned(val row: Int, val col: Int, val widget: Widget)

        val positioned = widgets.map { widget ->
            val pos = widget.layout
            if (pos.gridRow != null && pos.gridCol != null) {
                Positioned(pos.gridRow, pos.gridCol, widget)
            } else {
                val colSpan = (pos.colSpan ?: 1).coerceAtLeast(1)
                if (autoCol + colSpan > columns) {
                    autoRow++
                    autoCol = 0
                }
                val result = Positioned(autoRow, autoCol, widget)
                autoCol += colSpan
                if (autoCol >= columns) {
                    autoRow++
                    autoCol = 0
                }
                result
            }
        }

        val computedRows = rows ?: positioned.maxOfOrNull { p ->
            p.row + (p.widget.layout.rowSpan ?: 1).coerceAtLeast(1)
        }?.coerceAtLeast(1) ?: 1
        val cellHeight = if (computedRows > 0) {
            (maxHeight - spacing * (computedRows + 1)) / computedRows
        } else {
            maxHeight
        }

        positioned.forEach { (gridRow, gridCol, widget) ->
            val rowSpan = (widget.layout.rowSpan ?: 1).coerceAtLeast(1)
            val colSpan = (widget.layout.colSpan ?: 1).coerceAtLeast(1)
            val gc = gridCol.toFloat()
            val gr = gridRow.toFloat()
            val cs = colSpan.toFloat()
            val rs = rowSpan.toFloat()
            Box(
                modifier = Modifier
                    .offset(
                        x = spacing + (cellWidth + spacing) * gc,
                        y = spacing + (cellHeight + spacing) * gr
                    )
                    .size(
                        width = cellWidth * cs + spacing * (cs - 1f),
                        height = cellHeight * rs + spacing * (rs - 1f)
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
