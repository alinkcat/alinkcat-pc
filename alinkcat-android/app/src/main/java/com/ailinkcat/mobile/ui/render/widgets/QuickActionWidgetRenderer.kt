package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.QuickActionCell
import com.ailinkcat.mobile.domain.models.QuickActionWidget

/**
 * 快捷面板控件：2x2 或自定义行列的网格，每格为应用启动器或文本片段集合。
 * - launcher：显示图标 + 名称，点击发送 launcher_open 指令
 * - snippet：显示标题 + 片段数量，点击注入第一个片段
 * 使用 BoxWithConstraints 自适应容器尺寸。
 */
@Composable
fun QuickActionWidgetRenderer(
    widget: QuickActionWidget,
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    val cols = widget.columns.coerceIn(1, 6)
    val rows = widget.rows.coerceIn(1, 6)

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x1AFFFFFF))
            .padding(6.dp)
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        val spacing = 4.dp
        val spacingPx = 4f

        // 自适应字体尺寸基于单元格最小边长
        val cellWidth = (cw - spacingPx * (cols + 1)) / cols
        val cellHeight = (ch - spacingPx * (rows + 1)) / rows
        val cellSize = minOf(cellWidth, cellHeight)
        val iconSize = (cellSize * 0.3f).coerceIn(14f, 34f).sp
        val labelSize = (cellSize * 0.125f).coerceIn(9f, 14f).sp
        val titleSize = (cellSize * 0.135f).coerceIn(10f, 15f).sp
        val countSize = (cellSize * 0.1f).coerceIn(8f, 11f).sp

        Column(
            verticalArrangement = Arrangement.spacedBy(spacing),
            modifier = Modifier.fillMaxSize()
        ) {
            for (row in 0 until rows) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(spacing),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    for (col in 0 until cols) {
                        val index = row * cols + col
                        if (index < widget.cells.size) {
                            QuickActionCellRenderer(
                                cell = widget.cells[index],
                                iconSize = iconSize,
                                labelSize = labelSize,
                                titleSize = titleSize,
                                countSize = countSize,
                                onLauncherClick = { path ->
                                    onButtonClick(
                                        widget.id,
                                        Action(type = "launcher_open", content = path)
                                    )
                                },
                                onSnippetClick = onSnippetClick,
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxSize()
                            )
                        } else {
                            // 空单元格占位
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxSize()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0x0DFFFFFF))
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 单个快捷面板单元格渲染。
 */
@Composable
private fun QuickActionCellRenderer(
    cell: QuickActionCell,
    iconSize: androidx.compose.ui.unit.TextUnit,
    labelSize: androidx.compose.ui.unit.TextUnit,
    titleSize: androidx.compose.ui.unit.TextUnit,
    countSize: androidx.compose.ui.unit.TextUnit,
    onLauncherClick: (String) -> Unit,
    onSnippetClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val isLauncher = cell.type == "launcher"

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0x1AFFFFFF))
            .clickable {
                if (isLauncher) {
                    onLauncherClick(cell.path)
                } else if (cell.snippets.isNotEmpty()) {
                    onSnippetClick(cell.snippets.first().content)
                }
            }
            .padding(4.dp),
        contentAlignment = Alignment.Center
    ) {
        if (isLauncher) {
            // 启动器：图标 + 名称
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "📱",
                    fontSize = iconSize
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = cell.name.ifBlank { "App" },
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = labelSize,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        } else {
            // 文本片段：标题 + 片段数量
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "📋",
                    fontSize = iconSize
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = cell.title.ifBlank { "Snippets" },
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = titleSize,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (cell.snippets.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.snippet_count, cell.snippets.size),
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = countSize,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}