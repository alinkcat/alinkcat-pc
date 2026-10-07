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
 * Page renderer: background layer (color + image, cover/contain/stretch, tile
 * via BitmapShader), then the widget layer inset by safe area insets. The
 * background bleeds edge-to-edge; only widgets avoid notch/cutout.
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

    // theme pack input isn't trusted: reject absolute paths and ".." traversal
    val bgImagePath = remember(themeId, page.backgroundImage) {
        page.backgroundImage?.takeIf { it.isNotBlank() && !it.startsWith("data:") }?.let { raw ->
            val normalized = raw.replace('\\', '/')
            if (normalized.startsWith("/") || normalized.split('/').any { it == ".." }) {
                null
            } else {
                normalized
            }
        }
    }
    val bgFile = remember(themeId, bgImagePath) {
        bgImagePath?.let { File(themeDir, "$themeId/$it") }
    }

    // tile mode needs the raw bitmap for BitmapShader
    val bgBitmap by produceState<Bitmap?>(initialValue = null, themeId, bgImagePath, isTile) {
        value = if (isTile) {
            withContext(Dispatchers.IO) {
                if (bgImagePath != null) {
                    ImageLoader.loadBitmap(themeDir, themeId, bgImagePath)
                } else null
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(bgColor.copy(alpha = bgColor.alpha * bgOpacity))
        )

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

        if (tileBrush != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .drawBehind { drawRect(tileBrush) }
            )
        }

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
