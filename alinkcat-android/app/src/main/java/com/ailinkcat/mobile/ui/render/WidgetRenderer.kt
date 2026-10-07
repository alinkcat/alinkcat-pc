package com.ailinkcat.mobile.ui.render

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.BatteryWidget
import com.ailinkcat.mobile.domain.models.ButtonWidget
import com.ailinkcat.mobile.domain.models.CalendarWidget
import com.ailinkcat.mobile.domain.models.CardWidget
import com.ailinkcat.mobile.domain.models.ClockWidget
import com.ailinkcat.mobile.domain.models.DateWidget
import com.ailinkcat.mobile.domain.models.GaugeWidget
import com.ailinkcat.mobile.domain.models.ImageWidget
import com.ailinkcat.mobile.domain.models.LauncherIconWidget
import com.ailinkcat.mobile.domain.models.MediaControlWidget
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.ShapeWidget
import com.ailinkcat.mobile.domain.models.StickyNoteWidget
import com.ailinkcat.mobile.domain.models.SystemMonitorWidget
import com.ailinkcat.mobile.domain.models.TextWidget
import com.ailinkcat.mobile.domain.models.WebViewWidget
import com.ailinkcat.mobile.domain.models.Widget
import com.ailinkcat.mobile.domain.models.WidgetType
import com.ailinkcat.mobile.ui.render.widgets.ButtonWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.BatteryWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.CalendarWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.CardWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.ClockWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.DateWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.GaugeWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.ImageWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.LauncherIconWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.MediaControlWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.ShapeWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.StickyNoteWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.SystemMonitorWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.TextWidgetRenderer
import com.ailinkcat.mobile.ui.render.widgets.WebViewWidgetRenderer
import com.ailinkcat.mobile.domain.models.QuickActionWidget
import com.ailinkcat.mobile.ui.render.widgets.QuickActionWidgetRenderer
import com.ailinkcat.mobile.domain.models.WeatherWidget
import com.ailinkcat.mobile.ui.render.widgets.WeatherWidgetRenderer
import java.io.File
import android.widget.LinearLayout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

/** widget router: dispatches each type to its widget renderer, unknown types get a placeholder. */
@Suppress("REDUNDANT_ELSE_IN_WHEN")
@Composable
fun WidgetRenderer(
    widget: Widget,
    themeId: String,
    themeDir: File,
    widgetData: Map<String, Float>,
    mediaState: MediaState,
    onButtonClick: (String, Action) -> Unit,
    onSnippetClick: (String) -> Unit
) {
    when (widget) {
        is ButtonWidget -> ButtonWidgetRenderer(
            widget = widget,
            onClick = { onButtonClick(widget.id, widget.action ?: Action()) }
        )

        is GaugeWidget -> GaugeWidgetRenderer(
            widget = widget,
            value = widgetData[DataSourceResolver.resolve(widget.dataSource)]
        )

        is BatteryWidget -> BatteryWidgetRenderer(
            widget = widget,
            value = widgetData[DataSourceResolver.resolve(widget.dataSource)],
            temperature = widgetData[DataSourceResolver.resolve("system.battery.temperature")]
        )

        is StickyNoteWidget -> StickyNoteWidgetRenderer(
            widget = widget,
            onSnippetClick = onSnippetClick
        )

        is ImageWidget -> ImageWidgetRenderer(
            widget = widget,
            baseDir = File(themeDir, themeId),
            onClick = { action -> onButtonClick(widget.id, action) }
        )

        is TextWidget -> TextWidgetRenderer(
            widget = widget,
            onClick = { action -> onButtonClick(widget.id, action) }
        )

        is ShapeWidget -> ShapeWidgetRenderer(widget)

        is WebViewWidget -> WebViewWidgetRenderer(widget)

        is MediaControlWidget -> MediaControlWidgetRenderer(
            widget = widget,
            mediaState = mediaState,
            onPlayPause = { onButtonClick(widget.id, Action(type = "media_play_pause")) },
            onPrev = { onButtonClick(widget.id, Action(type = "media_previous")) },
            onNext = { onButtonClick(widget.id, Action(type = "media_next")) },
            onVolumeChange = { vol -> onButtonClick(widget.id, Action(type = "media_volume_set", content = vol.toString())) }
        )

        is SystemMonitorWidget -> SystemMonitorWidgetRenderer(
            widget = widget,
            widgetData = widgetData,
            onClick = { action -> onButtonClick(widget.id, action) }
        )

        is LauncherIconWidget -> LauncherIconWidgetRenderer(
            widget = widget,
            themeDir = themeDir,
            themeId = themeId,
            onClick = { onButtonClick(widget.id, Action(type = "launcher_open", content = widget.appId)) }
        )

        is ClockWidget -> ClockWidgetRenderer(widget = widget)

        is DateWidget -> DateWidgetRenderer(widget = widget)

        is CalendarWidget -> CalendarWidgetRenderer(widget = widget, widgetData = widgetData)

        is CardWidget -> CardWidgetRenderer(widget = widget, themeDir = themeDir, themeId = themeId)

        is QuickActionWidget -> QuickActionWidgetRenderer(
            widget = widget,
            onButtonClick = onButtonClick,
            onSnippetClick = onSnippetClick
        )

        is WeatherWidget -> WeatherWidgetRenderer(widget = widget)

        else -> PlaceholderWidget(widget.id)
    }
}

@Composable
private fun PlaceholderWidget(widgetId: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF3A3A3A)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = widgetId,
            color = Color.Gray,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color.Black.copy(alpha = 0.3f))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

internal fun parseFontWeight(value: String?): FontWeight {
    return when (value?.lowercase()) {
        "bold" -> FontWeight.Bold
        "semibold", "semi_bold", "600" -> FontWeight.SemiBold
        "medium", "500" -> FontWeight.Medium
        "light", "300" -> FontWeight.Light
        "thin", "100" -> FontWeight.Thin
        else -> FontWeight.Normal
    }
}
