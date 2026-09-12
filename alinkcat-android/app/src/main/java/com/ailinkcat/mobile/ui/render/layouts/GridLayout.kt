package com.ailinkcat.mobile.ui.render.layouts

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.Widget
import com.ailinkcat.mobile.ui.render.WidgetRenderer
import java.io.File

/**
 * 网格布局：按 columns×rows 切分单元格，控件按 gridRow/gridCol 定位、rowSpan/colSpan 跨格。
 * 无显式坐标的控件按顺序从左到右、从上到下自动填充。
 *
 * 横竖屏适配：
 * - 竖屏：网格在窄而高的屏幕上会横向压扁 / 纵向拉长（严重变形）。
 *   使用「统一单元格尺寸」cellSize = min(cellWidth, cellHeight)，单元格保持正方形，
 *   网格整体在屏幕上居中对齐，视觉一致、不严重变形。
 * - 横屏：设计基准 (1280x720) 本身即宽×矮网格，保持原始比例匹配设计意图，
 *   仅将间距从竖屏的 5dp 回升到 8dp。
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
        // 横竖屏使用不同间距：竖屏空间有限，缩小间距让单元格更大
        val spacing: Dp = if (isLandscape) 8.dp else 5.dp
        val safeColumns = columns.coerceAtLeast(1)

        // 先算好每个控件的网格位置（自动填充 + 显式定位）
        // remember 缓存：widgetData 高频推送重组时跳过网格重算
        data class Positioned(val row: Int, val col: Int, val widget: Widget)

        val positioned = remember(widgets, columns) {
            var autoRow = 0
            var autoCol = 0
            widgets.map { widget ->
                val pos = widget.layout
                if (pos.gridRow != null && pos.gridCol != null) {
                    // 显式定位：钳制到网格范围内
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

        // 单元格宽高占满可用空间；不足时钳制非负
        val rawCellWidth = ((maxWidth - spacing * (safeColumns + 1)) / safeColumns).coerceAtLeast(1.dp)
        val rawCellHeight = if (computedRows > 0) {
            ((maxHeight - spacing * (computedRows + 1)) / computedRows).coerceAtLeast(1.dp)
        } else {
            maxHeight
        }

        // 竖屏统一单元格尺寸防变形；横屏保持原始比例
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

        // 网格整体尺寸（含间距），剩余空间居中
        val gridWidth = cellWidth * safeColumns + spacing * (safeColumns + 1)
        val gridHeight = cellHeight * computedRows + spacing * (computedRows + 1)
        val gridStartX = ((maxWidth - gridWidth) / 2f).coerceAtLeast(0.dp)
        val gridStartY = ((maxHeight - gridHeight) / 2f).coerceAtLeast(0.dp)

        positioned.forEach { (gridRow, gridCol, widget) ->
            val rowSpan = (widget.layout.rowSpan ?: 1).coerceAtLeast(1)
            val colSpan = (widget.layout.colSpan ?: 1).coerceIn(1, safeColumns)
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
