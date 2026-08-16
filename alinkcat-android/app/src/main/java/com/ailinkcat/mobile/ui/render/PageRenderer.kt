package com.ailinkcat.mobile.ui.render

import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Shader
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.LayoutMode
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.Page
import com.ailinkcat.mobile.ui.render.layouts.FreeLayout
import com.ailinkcat.mobile.ui.render.layouts.GridLayout
import com.ailinkcat.mobile.utils.ColorParser
import com.ailinkcat.mobile.utils.ImageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * 页面渲染器：
 * 1. 背景层：底色（按 backgroundOpacity 应用透明度）-> 背景图（Coil 加载，cover/contain/stretch）
 * 2. tile 平铺模式用 BitmapShader
 * 3. GRID：gridRow/gridCol 精确定位 + 自动填充
 *    FREE：百分比坐标 / 设计像素坐标等比缩放
 * 4. isLandscape 参数用于横竖屏适配，传递给子布局组件
 *
 * 安全区域：
 * - 背景层保持整屏边缘到边延伸，视觉连续
 * - 控件层应用 WindowInsets.safeDrawing（状态栏 + 导航栏 + 刘海/挖孔），
 *   保证主题内容不被刘海/挖孔遮挡
 */
@Composable
fun PageRenderer(
    page: Page,
    themeId: String,
    themeDir: File,
    widgetData: Map<String, Float>,
    mediaState: MediaState,
    isLandscape: Boolean = true,
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    val bgColor = ColorParser.parse(page.backgroundColor, Color(0xFF101320))
    val bgOpacity = ((page.backgroundOpacity ?: 100).coerceIn(0, 100)) / 100f
    val bgMode = page.backgroundMode ?: "cover"
    val isTile = bgMode == "tile" || bgMode == "repeat"

    // 背景图本地文件路径：files/themes/{themeId}/{backgroundImage}
    val bgFile = remember(themeId, page.backgroundImage) {
        page.backgroundImage?.takeIf { it.isNotBlank() && !it.startsWith("data:") }?.let {
            File(themeDir, "$themeId/$it")
        }
    }

    // tile 模式需要原始位图做 BitmapShader
    val bgBitmap by produceState<Bitmap?>(initialValue = null, themeId, page.backgroundImage, isTile) {
        value = if (isTile) {
            withContext(Dispatchers.IO) {
                ImageLoader.loadBitmap(themeDir, themeId, page.backgroundImage)
            }
        } else null
    }
    val tileBrush = remember(bgBitmap, isTile) {
        if (isTile) {
            bgBitmap?.let {
                val shader = BitmapShader(it, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
                ShaderBrush(shader)
            }
        } else null
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // ── 背景底色（位于图片之下，避免遮住图片） ──────────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bgColor.copy(alpha = bgColor.alpha * bgOpacity))
        )

        // ── 背景图（非 tile：Coil 加载） ───────────────────
        if (!isTile && bgFile != null && bgFile.exists()) {
            val scale = when (bgMode) {
                "contain" -> ContentScale.Fit
                "stretch", "fill" -> ContentScale.FillBounds
                else -> ContentScale.Crop // cover
            }
            AsyncImage(
                model = bgFile,
                contentDescription = null,
                contentScale = scale,
                alpha = bgOpacity,
                modifier = Modifier.fillMaxSize()
            )
        }

        // ── 背景图（tile 平铺） ────────────────────────────
        if (tileBrush != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .drawBehind { drawRect(tileBrush) }
            )
        }

        // ── 控件层（预留安全区域，避免被刘海/挖孔遮挡） ──────
        Box(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            when (page.layoutMode) {
                LayoutMode.GRID -> GridLayout(
                    columns = (page.columns ?: 4).coerceIn(1, 12),
                    rows = page.rows,
                    widgets = page.widgets,
                    themeId = themeId,
                    themeDir = themeDir,
                    widgetData = widgetData,
                    mediaState = mediaState,
                    isLandscape = isLandscape,
                    onButtonClick = onButtonClick,
                    onSnippetClick = onSnippetClick
                )

                LayoutMode.FREE -> FreeLayout(
                    widgets = page.widgets,
                    themeId = themeId,
                    themeDir = themeDir,
                    widgetData = widgetData,
                    mediaState = mediaState,
                    isLandscape = isLandscape,
                    onButtonClick = onButtonClick,
                    onSnippetClick = onSnippetClick
                )
            }
        }
    }
}
