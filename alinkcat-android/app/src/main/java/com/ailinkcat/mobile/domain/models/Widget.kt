package com.ailinkcat.mobile.domain.models

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

private const val WIDGET_TAG = "Widget"

/** 数值字段兼容字符串数字：先按字符串解析，失败再回退数值读取（PC 端可能导出字符串数字）。 */
private fun optFloatCompat(json: JSONObject, key: String): Float? {
    if (json.isNull(key)) return null
    val s = json.optString(key)
    if (s.isNotBlank()) {
        s.toFloatOrNull()?.let { return it }
    }
    return json.optDouble(key).takeIf { !it.isNaN() }?.toFloat()
}

private fun optIntCompat(json: JSONObject, key: String, default: Int = -1): Int {
    val s = json.optString(key)
    if (s.isNotBlank()) {
        s.toIntOrNull()?.let { return it }
    }
    return json.optInt(key, default)
}

enum class WidgetType { BUTTON, GAUGE, BATTERY, STICKY_NOTE, IMAGE, TEXT, SHAPE, WEBVIEW, MEDIA_CONTROL, SYSTEM_MONITOR, LAUNCHER_ICON, CLOCK, DATE, CALENDAR, CARD, QUICK_ACTION, WEATHER }

/**
 * 控件定位。
 * - 自由布局(FREE)：PC 端实际字段 freeX/freeY/freeW/freeH 为百分比 (0-100)；旧字段 x/y/width/height 为设计像素（按 1280x720 等比缩放）
 * - 网格布局(GRID)：gridRow/gridCol 为行列索引，rowSpan/colSpan 为跨行跨列数；PC 端实际字段 gridW -> colSpan，gridH -> rowSpan
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

/** 按钮 / 便签的交互动作。序列化：仅 type -> 字符串；含 content -> {type, content}。 */
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

/** 控件密封类：JSON 中通过 "type" 字段区分具体子类。 */
sealed class Widget {
    abstract val id: String
    abstract val type: WidgetType
    abstract val layout: WidgetLayout

    companion object {
        /**
         * 解析控件 JSON。
         * [fallbackId]：JSON 缺 id 或 id 为空时使用（如 "widget-{index}"）。
         */
        fun fromJson(json: JSONObject?, fallbackId: String = ""): Widget? {
            if (json == null) return null

            // PC 端实际坐标字段：freeX/freeY/freeW/freeH（百分比 0-100），gridW/gridH（跨列/跨行）
            // 旧字段：x/y/width/height（设计像素）、rowSpan/colSpan；数值兼容字符串数字
            val layout = WidgetLayout(
                x = optFloatCompat(json, "x"),
                y = optFloatCompat(json, "y"),
                width = optFloatCompat(json, "width"),
                height = optFloatCompat(json, "height"),
                freeX = optFloatCompat(json, "freeX")?.coerceIn(0f, 100f),
                freeY = optFloatCompat(json, "freeY")?.coerceIn(0f, 100f),
                freeW = optFloatCompat(json, "freeW")?.coerceIn(0f, 100f),
                freeH = optFloatCompat(json, "freeH")?.coerceIn(0f, 100f),
                gridRow = optIntCompat(json, "gridRow").takeIf { it >= 0 },
                gridCol = optIntCompat(json, "gridCol").takeIf { it >= 0 },
                rowSpan = optIntCompat(json, "gridH").takeIf { it >= 0 }
                    ?: optIntCompat(json, "rowSpan").takeIf { it >= 0 },
                colSpan = optIntCompat(json, "gridW").takeIf { it >= 0 }
                    ?: optIntCompat(json, "colSpan").takeIf { it >= 0 }
            )
            return when (json.optString("type")) {
                "button" -> ButtonWidget.fromJson(json, layout, fallbackId)
                "gauge" -> GaugeWidget.fromJson(json, layout, fallbackId)
                "battery" -> BatteryWidget.fromJson(json, layout, fallbackId)
                "sticky_note", "snippet-list" -> StickyNoteWidget.fromJson(json, layout, fallbackId)
                "image" -> ImageWidget.fromJson(json, layout, fallbackId)
                "icon" -> ButtonWidget.fromJson(json, layout, fallbackId)
                "text" -> TextWidget.fromJson(json, layout, fallbackId)
                "shape" -> ShapeWidget.fromJson(json, layout, fallbackId)
                "webview" -> WebViewWidget.fromJson(json, layout, fallbackId)
                "media-control" -> MediaControlWidget.fromJson(json, layout, fallbackId)
                "system-monitor" -> SystemMonitorWidget.fromJson(json, layout, fallbackId)
                "launcher_icon", "launcher" -> LauncherIconWidget.fromJson(json, layout, fallbackId)
                "clock" -> ClockWidget.fromJson(json, layout, fallbackId)
                "date" -> DateWidget.fromJson(json, layout, fallbackId)
                "calendar" -> CalendarWidget.fromJson(json, layout, fallbackId)
                "card" -> CardWidget.fromJson(json, layout, fallbackId)
                "quick-action" -> QuickActionWidget.fromJson(json, layout, fallbackId)
                "weather" -> WeatherWidget.fromJson(json, layout, fallbackId)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): ButtonWidget? = try {
            ButtonWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
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
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 }?.coerceIn(1, 200),
                fontWeight = json.optString("fontWeight").ifBlank { null },
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 }?.coerceIn(0, 200)
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "ButtonWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): GaugeWidget? = try {
            GaugeWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
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
                ringThickness = json.optInt("ringThickness", -1).takeIf { it > 0 }?.coerceIn(1, 100)
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "GaugeWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

data class BatteryWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.BATTERY,
    override val layout: WidgetLayout,
    val label: String,
    val batteryStyle: String?, // bar / ring / number
    val showLevel: Boolean,
    val showCharging: Boolean,
    val showTemp: Boolean,
    val barColor: String?,
    val lowColor: String?,
    val lowThreshold: Int?,
    val dataSource: String
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): BatteryWidget? = try {
            BatteryWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Battery"),
                batteryStyle = json.optString("batteryStyle").ifBlank { null },
                showLevel = json.optBoolean("showLevel", true),
                showCharging = json.optBoolean("showCharging", true),
                showTemp = json.optBoolean("showTemp", false),
                barColor = json.optString("barColor").ifBlank { null },
                lowColor = json.optString("lowColor").ifBlank { null },
                lowThreshold = json.optInt("lowThreshold", -1).takeIf { it >= 0 }?.coerceIn(0, 100),
                dataSource = json.optString("dataSource", "system.battery.level")
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "BatteryWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): StickyNoteWidget? = try {
            // PC 端字段为 snippets: [{id,label,content}]；items、notes 为旧版字段
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
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Sticky Note"),
                notes = notes,
                backgroundColor = json.optString("backgroundColor").ifBlank { null },
                textColor = json.optString("textColor").ifBlank { null }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "StickyNoteWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): ImageWidget? = try {
            ImageWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                // PC 端字段名为 src
                imagePath = json.optString("imagePath").ifBlank { json.optString("src").ifBlank { null } },
                scaleMode = json.optString("scaleMode").ifBlank { null }
                    ?: json.optString("objectFit").ifBlank { null },
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 }?.coerceIn(0, 200),
                clickAction = json.optJSONObject("clickAction")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "ImageWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): TextWidget? = try {
            TextWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                // PC 端字段名为 content
                text = json.optString("text").ifBlank { json.optString("content", "") },
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 }?.coerceIn(1, 200),
                // PC 端字段名为 color
                textColor = json.optString("textColor").ifBlank { json.optString("color").ifBlank { null } },
                fontWeight = json.optString("fontWeight").ifBlank { null },
                textAlign = json.optString("textAlign").ifBlank { null },
                clickAction = json.optJSONObject("clickAction")?.let {
                    Action(
                        type = it.optString("type", "click"),
                        content = it.optString("content").ifBlank { null }
                    )
                }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "TextWidget.fromJson failed, id=${json.optString("id")}", e)
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
    val strokeWidth: Int?,
    val borderRadius: Int?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): ShapeWidget? = try {
            ShapeWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                shapeType = json.optString("shapeType").ifBlank { null },
                fillColor = json.optString("fillColor").ifBlank { null },
                gradientTo = json.optString("gradientTo").ifBlank { null },
                strokeColor = json.optString("strokeColor").ifBlank { null },
                strokeWidth = json.optInt("strokeWidth", -1).takeIf { it >= 0 }?.coerceIn(0, 100),
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 }?.coerceIn(0, 200)
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "ShapeWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

data class WebViewWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.WEBVIEW,
    override val layout: WidgetLayout,
    val url: String?,
    // JSON 数据展示模式（对应 PC 端 WebViewJSON）
    val displayMode: String = "webpage", // webpage / rss / json
    val jsonUrl: String = "",
    val titleField: String = "title",
    val descField: String = "description",
    val timeField: String = "pubDate",
    val linkField: String = "link",
    val refreshInterval: Int = 0, // 秒
    val headers: Map<String, String> = emptyMap() // 自定义请求头（如 Authorization: Bearer <token>）
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): WebViewWidget? = try {
            val headerObj = json.optJSONObject("headers")
            WebViewWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                url = json.optString("url").ifBlank { null },
                displayMode = json.optString("displayMode", "webpage"),
                jsonUrl = json.optString("jsonUrl", ""),
                titleField = json.optString("titleField", "title"),
                descField = json.optString("descField", "description"),
                timeField = json.optString("timeField", "pubDate"),
                linkField = json.optString("linkField", "link"),
                refreshInterval = json.optInt("refreshInterval", 0).coerceIn(0, 86400),
                headers = buildMap {
                    if (headerObj != null) {
                        headerObj.keys().forEach { k -> put(k, headerObj.optString(k)) }
                    }
                }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "WebViewWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): MediaControlWidget? = try {
            val props = json.optJSONObject("properties")
            MediaControlWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Music Control"),
                displayMode = json.optString("displayMode", "always"),
                showCover = props?.optBoolean("showCover", true) ?: true,
                showProgress = props?.optBoolean("showProgress", true) ?: true
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "MediaControlWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

/** PC 端实时推送的媒体播放状态。basePosition / baseSystemTime 用于本地插值，实现进度条平滑滚动。 */
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): SystemMonitorWidget? = try {
            val props = json.optJSONObject("properties")
            SystemMonitorWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
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
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "SystemMonitorWidget.fromJson failed, id=${json.optString("id")}", e)
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): LauncherIconWidget? = try {
            LauncherIconWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                appId = json.optString("path", json.optString("id", "")),
                label = json.optString("name", json.optString("label", "App")),
                icon = json.optString("icon").ifBlank { null }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "LauncherIconWidget.fromJson failed, id=${json.optString("id")}", e)
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
    val showSeconds: Boolean,
    val showAmpm: Boolean = false,
    val clockDisplay: String = "digital", // digital / analog
    val showWeekday: Boolean = false,     // 在时间下方显示星期几
    val tickMarks: Boolean = true,
    val showNumbers: Boolean = true,
    val handStyle: String = "classic",   // classic / modern / thin
    val faceColor: String = "#ffffff",
    val handColor: String = "#333333"
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): ClockWidget? = try {
            val props = json.optJSONObject("properties")
            ClockWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Clock"),
                // 字段可能在 properties 或顶层（PC 端通常在顶层）
                format24h = props?.optBoolean("format24h") ?: json.optBoolean("format24h", true),
                showSeconds = props?.optBoolean("showSeconds") ?: json.optBoolean("showSeconds", true),
                showAmpm = props?.optBoolean("showAmpm") ?: json.optBoolean("showAmpm", false),
                clockDisplay = props?.optString("clockDisplay") ?: json.optString("clockDisplay", "digital"),
                showWeekday = props?.optBoolean("showWeekday") ?: json.optBoolean("showWeekday", false),
                tickMarks = props?.optBoolean("tickMarks") ?: json.optBoolean("tickMarks", true),
                showNumbers = props?.optBoolean("showNumbers") ?: json.optBoolean("showNumbers", true),
                handStyle = props?.optString("handStyle") ?: json.optString("handStyle", "classic"),
                faceColor = props?.optString("faceColor") ?: json.optString("faceColor", "#ffffff"),
                handColor = props?.optString("handColor") ?: json.optString("handColor", "#333333")
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "ClockWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
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
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): DateWidget? = try {
            val props = json.optJSONObject("properties")
            DateWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Date"),
                showLunar = props?.optBoolean("showLunar", false) ?: false
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "DateWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

data class CalendarWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.CALENDAR,
    override val layout: WidgetLayout,
    val label: String,
    val backgroundColor: String? = null,
    val textColor: String? = null
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): CalendarWidget? = try {
            CalendarWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Calendar"),
                backgroundColor = json.optString("backgroundColor", null).takeIf { !it.isNullOrBlank() },
                textColor = json.optString("textColor", null).takeIf { !it.isNullOrBlank() }
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "CalendarWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

/**
 * 信息卡片：文本（标题/描述）+ 配图 + 标签 + 底部辅助文字。
 * PC 端字段：cardTitle/cardDesc/cardImage/cardImagePosition(top/left/right)/cardTags[]/cardFooter。
 */
data class CardWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.CARD,
    override val layout: WidgetLayout,
    val label: String,
    val cardTitle: String,
    val cardDesc: String,
    val cardImage: String?,
    val cardImagePosition: String, // top / left / right
    val cardTags: List<String>,
    val cardFooter: String,
    val backgroundColor: String?,
    val backgroundOpacity: Int?,
    val textColor: String?,
    val fontSize: Int?,
    val fontWeight: String?,
    val borderRadius: Int?
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): CardWidget? = try {
            val tagsArray = json.optJSONArray("cardTags") ?: JSONArray()
            val tags = buildList {
                for (i in 0 until tagsArray.length()) {
                    tagsArray.optString(i).takeIf { it.isNotBlank() }?.let { add(it) }
                }
            }
            CardWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Card"),
                cardTitle = json.optString("cardTitle", ""),
                cardDesc = json.optString("cardDesc", ""),
                cardImage = json.optString("cardImage").ifBlank { null },
                cardImagePosition = json.optString("cardImagePosition", "top"),
                cardTags = tags,
                cardFooter = json.optString("cardFooter", ""),
                backgroundColor = json.optString("backgroundColor").ifBlank { null },
                backgroundOpacity = json.optInt("backgroundOpacity", -1).takeIf { it in 0..100 },
                textColor = json.optString("textColor").ifBlank { null },
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 }?.coerceIn(1, 200),
                fontWeight = json.optString("fontWeight").ifBlank { null },
                borderRadius = json.optInt("borderRadius", -1).takeIf { it >= 0 }?.coerceIn(0, 200)
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "CardWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

/** 快捷面板中的文本片段项。 */
data class QuickActionSnippetItem(
    val id: String = "",
    val label: String = "",
    val content: String = ""
)

/**
 * 快捷面板中的单个单元格。
 * - launcher: type/name/path；snippet: type/title/snippets
 */
data class QuickActionCell(
    val type: String, // "launcher" or "snippet"
    val name: String = "",
    val path: String = "",
    val title: String = "",
    val snippets: List<QuickActionSnippetItem> = emptyList()
)

/** 快捷面板：2x2 或自定义行列网格，每格为启动器或文本片段集合。PC 端字段：columns, rows, cells[]。 */
data class QuickActionWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.QUICK_ACTION,
    override val layout: WidgetLayout,
    val columns: Int = 2,
    val rows: Int = 2,
    val cells: List<QuickActionCell> = emptyList()
) : Widget() {
    companion object {
        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): QuickActionWidget? = try {
            val cellsArray = json.optJSONArray("cells") ?: JSONArray()
            val cells = buildList {
                for (i in 0 until cellsArray.length()) {
                    val cell = cellsArray.optJSONObject(i) ?: continue
                    val type = cell.optString("type", "launcher")
                    val snippetsArray = cell.optJSONArray("snippets") ?: JSONArray()
                    val snippets = buildList {
                        for (j in 0 until snippetsArray.length()) {
                            val s = snippetsArray.optJSONObject(j) ?: continue
                            add(
                                QuickActionSnippetItem(
                                    id = s.optString("id", ""),
                                    label = s.optString("label", ""),
                                    content = s.optString("content", "")
                                )
                            )
                        }
                    }
                    add(
                        QuickActionCell(
                            type = type,
                            name = cell.optString("name", ""),
                            path = cell.optString("path", ""),
                            title = cell.optString("title", ""),
                            snippets = snippets
                        )
                    )
                }
            }
            QuickActionWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                columns = json.optInt("columns", 2).coerceIn(1, 6),
                rows = json.optInt("rows", 2).coerceIn(1, 6),
                cells = cells
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "QuickActionWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}
