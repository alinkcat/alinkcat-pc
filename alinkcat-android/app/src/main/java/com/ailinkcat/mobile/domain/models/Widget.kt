package com.ailinkcat.mobile.domain.models

import org.json.JSONArray
import org.json.JSONObject

enum class WidgetType { BUTTON, GAUGE, STICKY_NOTE, IMAGE, TEXT, SHAPE, WEBVIEW, MEDIA_CONTROL, SYSTEM_MONITOR, LAUNCHER_ICON, CLOCK, DATE, CALENDAR }

/**
 * 控件定位。
 * - 自由布局(FREE)：
 *   - PC 端实际字段 freeX/freeY/freeW/freeH 为百分比 (0-100)
 *   - 兼容字段 x/y/width/height 为设计像素坐标（按设计基准 1280x720 等比缩放）
 * - 网格布局(GRID)：gridRow/gridCol 为行列索引，rowSpan/colSpan 为跨行跨列数
 *   - PC 端实际字段 gridW -> colSpan，gridH -> rowSpan
 */
data class WidgetLayout(
    val x: Float? = null,
    val y: Float? = null,
    val width: Float? = null,
    val height: Float? = null,
    val freeX: Float? = null,
    val freeY: Float? = null,
    val freeW: Float? = null,
    val freeH: Float? = null,
    val gridRow: Int? = null,
    val gridCol: Int? = null,
    val rowSpan: Int? = null,
    val colSpan: Int? = null
)

/**
 * 按钮 / 便签的交互动作。序列化时：仅 type -> 字符串；含 content -> {type, content}。
 */
data class Action(
    val type: String = "click",
    val content: String? = null
) {
    fun asJsonValue(): Any {
        return if (content.isNullOrBlank()) {
            type
        } else {
            JSONObject()
                .put("type", type)
                .put("content", content)
        }
    }
}

data class NoteItem(val label: String, val content: String)

/**
 * 控件密封类。JSON 中通过 "type" 字段区分具体子类。
 */
sealed class Widget {
    abstract val id: String
    abstract val type: WidgetType
    abstract val layout: WidgetLayout

    companion object {
        fun fromJson(json: JSONObject?): Widget? {
            if (json == null) return null

            // PC 端实际坐标字段：freeX/freeY/freeW/freeH（百分比），gridW/gridH（跨列/跨行）
            // 兼容旧字段：x/y/width/height（设计像素），rowSpan/colSpan
            val layout = WidgetLayout(
                x = json.optDouble("x").takeIf { !it.isNaN() }?.toFloat(),
                y = json.optDouble("y").takeIf { !it.isNaN() }?.toFloat(),
                width = json.optDouble("width").takeIf { !it.isNaN() }?.toFloat(),
                height = json.optDouble("height").takeIf { !it.isNaN() }?.toFloat(),
                freeX = json.optDouble("freeX").takeIf { !it.isNaN() }?.toFloat(),
                freeY = json.optDouble("freeY").takeIf { !it.isNaN() }?.toFloat(),
                freeW = json.optDouble("freeW").takeIf { !it.isNaN() }?.toFloat(),
                freeH = json.optDouble("freeH").takeIf { !it.isNaN() }?.toFloat(),
                gridRow = json.optInt("gridRow", -1).takeIf { it >= 0 },
                gridCol = json.optInt("gridCol", -1).takeIf { it >= 0 },
                rowSpan = json.optInt("gridH", -1).takeIf { it >= 0 }
                    ?: json.optInt("rowSpan", -1).takeIf { it >= 0 },
                colSpan = json.optInt("gridW", -1).takeIf { it >= 0 }
                    ?: json.optInt("colSpan", -1).takeIf { it >= 0 }
            )
            return when (json.optString("type")) {
                "button" -> ButtonWidget.fromJson(json, layout)
                "gauge" -> GaugeWidget.fromJson(json, layout)
                "sticky_note", "snippet-list" -> StickyNoteWidget.fromJson(json, layout)
                "image" -> ImageWidget.fromJson(json, layout)
                "icon" -> ButtonWidget.fromJson(json, layout)
                "text" -> TextWidget.fromJson(json, layout)
                "shape" -> ShapeWidget.fromJson(json, layout)
                "webview" -> WebViewWidget.fromJson(json, layout)
                "media-control" -> MediaControlWidget.fromJson(json, layout)
                "system-monitor" -> SystemMonitorWidget.fromJson(json, layout)
                "launcher_icon", "launcher" -> LauncherIconWidget.fromJson(json, layout)
                "clock" -> ClockWidget.fromJson(json, layout)
                "date" -> DateWidget.fromJson(json, layout)
                "calendar" -> CalendarWidget.fromJson(json, layout)
                else -> null
            }
        }
    }
}

data class ButtonWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.BUTTON,
    override val layout: WidgetLayout,
    val label: String,
    val icon: String?,
    val action: Action?,
    val backgroundColor: String?,
    val backgroundOpacity: Int?,
    val textColor: String?,
    val fontSize: Int?,
    val fontWeight: String?,
    val borderRadius: Int?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): ButtonWidget? = try {
            ButtonWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Button"),
                icon = json.optString("icon").ifBlank { null },
                action = json.optJSONObject("action")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                } ?: json.optString("action").ifBlank { null }?.let {
                    // PC 端 action 可能是字符串（如 "keyboard"）
                    Action(type = it)
                },
                backgroundColor = json.optString("backgroundColor").ifBlank { null },
                backgroundOpacity = json.optInt("backgroundOpacity", -1).takeIf { it in 0..100 },
                textColor = json.optString("textColor").ifBlank { null },
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 },
                fontWeight = json.optString("fontWeight").ifBlank { null },
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class GaugeWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.GAUGE,
    override val layout: WidgetLayout,
    val label: String,
    val dataSource: String,
    val min: Int?,
    val max: Int?,
    val unit: String?,
    val displayStyle: String?, // ring / number / bar
    val ringColorLow: String?,
    val ringColorMid: String?,
    val ringColorHigh: String?,
    val ringThickness: Int?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): GaugeWidget? = try {
            GaugeWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Gauge"),
                dataSource = json.optString("dataSource", ""),
                min = json.optInt("min", -1).takeIf { it >= 0 },
                max = json.optInt("max", -1).takeIf { it >= 0 },
                unit = json.optString("unit").ifBlank { null },
                displayStyle = json.optString("displayStyle").ifBlank { null },
                ringColorLow = json.optString("ringColorLow").ifBlank { null },
                ringColorMid = json.optString("ringColorMid").ifBlank { null },
                ringColorHigh = json.optString("ringColorHigh").ifBlank { null },
                ringThickness = json.optInt("ringThickness", -1).takeIf { it > 0 }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class StickyNoteWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.STICKY_NOTE,
    override val layout: WidgetLayout,
    val label: String,
    val notes: List<NoteItem>,
    val backgroundColor: String?,
    val textColor: String?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): StickyNoteWidget? = try {
            // PC 端字段为 snippets: [{id,label,content}]；items 为旧兼容；notes 为更旧兼容
            val notesArray = json.optJSONArray("snippets")
                ?: json.optJSONArray("items")
                ?: json.optJSONArray("notes")
                ?: JSONArray()
            val notes = buildList {
                for (i in 0 until notesArray.length()) {
                    val n = notesArray.optJSONObject(i) ?: continue
                    add(
                        NoteItem(
                            label = n.optString("label", "Label"),
                            content = n.optString("content", "")
                        )
                    )
                }
            }
            StickyNoteWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Sticky Note"),
                notes = notes,
                backgroundColor = json.optString("backgroundColor").ifBlank { null },
                textColor = json.optString("textColor").ifBlank { null }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ImageWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.IMAGE,
    override val layout: WidgetLayout,
    val imagePath: String?,
    val scaleMode: String?, // cover / contain / stretch
    val borderRadius: Int?,
    val clickAction: Action? = null
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): ImageWidget? = try {
            ImageWidget(
                id = json.getString("id"),
                layout = layout,
                imagePath = json.optString("imagePath").ifBlank { null },
                scaleMode = json.optString("scaleMode").ifBlank { null }
                    ?: json.optString("objectFit").ifBlank { null },
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 },
                clickAction = json.optJSONObject("clickAction")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class TextWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.TEXT,
    override val layout: WidgetLayout,
    val text: String,
    val fontSize: Int?,
    val textColor: String?,
    val fontWeight: String?,
    val textAlign: String?, // start / center / end
    val clickAction: Action? = null
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): TextWidget? = try {
            TextWidget(
                id = json.getString("id"),
                layout = layout,
                text = json.optString("text", ""),
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 },
                textColor = json.optString("textColor").ifBlank { null },
                fontWeight = json.optString("fontWeight").ifBlank { null },
                textAlign = json.optString("textAlign").ifBlank { null },
                clickAction = json.optJSONObject("clickAction")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ShapeWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.SHAPE,
    override val layout: WidgetLayout,
    val shapeType: String?, // rectangle / rounded / circle / triangle / diamond
    val fillColor: String?,
    val gradientTo: String?,
    val strokeColor: String?,
    val strokeWidth: Int?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): ShapeWidget? = try {
            ShapeWidget(
                id = json.getString("id"),
                layout = layout,
                shapeType = json.optString("shapeType").ifBlank { null },
                fillColor = json.optString("fillColor").ifBlank { null },
                gradientTo = json.optString("gradientTo").ifBlank { null },
                strokeColor = json.optString("strokeColor").ifBlank { null },
                strokeWidth = json.optInt("strokeWidth", -1).takeIf { it >= 0 }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class WebViewWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.WEBVIEW,
    override val layout: WidgetLayout,
    val url: String?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): WebViewWidget? = try {
            WebViewWidget(
                id = json.getString("id"),
                layout = layout,
                url = json.optString("url").ifBlank { null }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class MediaControlWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.MEDIA_CONTROL,
    override val layout: WidgetLayout,
    val label: String,
    val displayMode: String,       // "always" | "playing_only"
    val showCover: Boolean,
    val showProgress: Boolean
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): MediaControlWidget? = try {
            val props = json.optJSONObject("properties")
            MediaControlWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Music Control"),
                displayMode = json.optString("displayMode", "always"),
                showCover = props?.optBoolean("showCover", true) ?: true,
                showProgress = props?.optBoolean("showProgress", true) ?: true
            )
        } catch (_: Exception) {
            null
        }
    }
}

/**
 * PC 端实时推送的媒体播放状态。
 * basePosition / baseSystemTime 用于本地插值计算，实现进度条平滑滚动。
 */
data class MediaState(
    val title: String? = null,
    val artist: String? = null,
    val coverUrl: String? = null,
    val isPlaying: Boolean = false,
    val position: Long = 0L,
    val duration: Long = 0L,
    val volume: Int = 50, // 0-100
    val basePosition: Long = 0L,
    val baseSystemTime: Long = 0L
)

data class SystemMonitorWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.SYSTEM_MONITOR,
    override val layout: WidgetLayout,
    val label: String,
    val showCpu: Boolean,
    val showMemory: Boolean,
    val showDisk: Boolean,
    val showNetwork: Boolean,
    val clickAction: Action? = null
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): SystemMonitorWidget? = try {
            val props = json.optJSONObject("properties")
            SystemMonitorWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "System Monitor"),
                showCpu = props?.optBoolean("showCpu", true) ?: true,
                showMemory = props?.optBoolean("showMemory", true) ?: true,
                showDisk = props?.optBoolean("showDisk", true) ?: true,
                showNetwork = props?.optBoolean("showNetwork", true) ?: true,
                clickAction = json.optJSONObject("clickAction")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class LauncherIconWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.LAUNCHER_ICON,
    override val layout: WidgetLayout,
    val appId: String,
    val label: String,
    val icon: String?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): LauncherIconWidget? = try {
            LauncherIconWidget(
                id = json.getString("id"),
                layout = layout,
                appId = json.optString("path", json.optString("id", "")),
                label = json.optString("name", json.optString("label", "App")),
                icon = json.optString("icon").ifBlank { null }
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ClockWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.CLOCK,
    override val layout: WidgetLayout,
    val label: String,
    val format24h: Boolean,
    val showSeconds: Boolean
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): ClockWidget? = try {
            val props = json.optJSONObject("properties")
            ClockWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Clock"),
                format24h = props?.optBoolean("format24h", true) ?: true,
                showSeconds = props?.optBoolean("showSeconds", true) ?: true
            )
        } catch (_: Exception) { null }
    }
}

data class DateWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.DATE,
    override val layout: WidgetLayout,
    val label: String,
    val showLunar: Boolean
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): DateWidget? = try {
            val props = json.optJSONObject("properties")
            DateWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Date"),
                showLunar = props?.optBoolean("showLunar", false) ?: false
            )
        } catch (_: Exception) { null }
    }
}

data class CalendarWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.CALENDAR,
    override val layout: WidgetLayout,
    val label: String
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout): CalendarWidget? = try {
            CalendarWidget(
                id = json.getString("id"),
                layout = layout,
                label = json.optString("label", "Calendar")
            )
        } catch (_: Exception) { null }
    }
}
