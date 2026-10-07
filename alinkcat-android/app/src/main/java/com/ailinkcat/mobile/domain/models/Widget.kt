package com.ailinkcat.mobile.domain.models

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

private const val WIDGET_TAG = "Widget"

/** PC exports may write numbers as strings, try string first then numeric */
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

/** widget placement. FREE: freeX/freeY/freeW/freeH are percent 0-100, legacy x/y/width/height
 *  are design pixels (scaled from 1280x720). GRID: gridRow/gridCol indexes, PC-side
 *  gridW -> colSpan and gridH -> rowSpan */
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

/** button/sticky-note action; serialized as the type string alone, or {type, content} with content */
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

/** widget variants, discriminated by the "type" field in JSON */
sealed class Widget {
    abstract val id: String
    abstract val type: WidgetType
    abstract val layout: WidgetLayout

    companion object {
        /** [fallbackId] is used when the JSON has no id (e.g. "widget-{index}") */
        fun fromJson(json: JSONObject?, fallbackId: String = ""): Widget? {
            if (json == null) return null

            // current PC-side fields: freeX/freeY/freeW/freeH (percent 0-100), gridW/gridH (span)
            // legacy: x/y/width/height (design pixels), rowSpan/colSpan; numbers may be strings
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
                    // action can be a plain string on the PC side (e.g. "keyboard")
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
                // PC side calls these minValue/maxValue
                min = json.optInt("min", -1).takeIf { it >= 0 }
                    ?: json.optInt("minValue", -1).takeIf { it >= 0 },
                max = json.optInt("max", -1).takeIf { it >= 0 }
                    ?: json.optInt("maxValue", -1).takeIf { it >= 0 },
                unit = json.optString("unit").ifBlank { null },
                // PC side calls this gaugeStyle, same values
                displayStyle = json.optString("displayStyle").ifBlank { json.optString("gaugeStyle").ifBlank { null } },
                ringColorLow = json.optString("ringColorLow").ifBlank { null },
                ringColorMid = json.optString("ringColorMid").ifBlank { null },
                ringColorHigh = json.optString("ringColorHigh").ifBlank { null },
                // PC ringWidth is 1-6, scaled 1:2 to dp
                ringThickness = json.optInt("ringThickness", -1).takeIf { it > 0 }?.coerceIn(1, 100)
                    ?: json.optInt("ringWidth", -1).takeIf { it > 0 }?.times(2)?.coerceIn(4, 20)
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
            // PC field is snippets: [{id,label,content}]; items/notes are legacy
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
                // PC field name is src
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
                // PC field name is content
                text = json.optString("text").ifBlank { json.optString("content", "") },
                fontSize = json.optInt("fontSize", -1).takeIf { it > 0 }?.coerceIn(1, 200),
                // PC field name is color
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
            // PC uses gradientStart/End for fills, borderColor/Width for strokes
            val fillType = json.optString("fillType", "solid")
            val shapeTypeRaw = json.optString("shapeType").ifBlank { null }?.lowercase()
            ShapeWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                shapeType = when (shapeTypeRaw) {
                    "rounded-rect" -> "rounded"
                    else -> shapeTypeRaw
                },
                fillColor = if (fillType == "gradient") {
                    json.optString("gradientStart").ifBlank { json.optString("fillColor").ifBlank { null } }
                } else {
                    json.optString("fillColor").ifBlank { null }
                },
                gradientTo = if (fillType == "gradient") {
                    json.optString("gradientEnd").ifBlank { json.optString("gradientTo").ifBlank { null } }
                } else {
                    json.optString("gradientTo").ifBlank { null }
                },
                strokeColor = json.optString("strokeColor").ifBlank { json.optString("borderColor").ifBlank { null } },
                strokeWidth = json.optInt("strokeWidth", -1).takeIf { it >= 0 }?.coerceIn(0, 100)
                    ?: json.optInt("borderWidth", -1).takeIf { it >= 0 }?.coerceIn(0, 100),
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
    // json display mode (PC-side WebViewJSON)
    val displayMode: String = "webpage", // webpage / rss / json
    val jsonUrl: String = "",
    // feed url when displayMode=rss
    val rssUrl: String = "",
    val titleField: String = "title",
    val descField: String = "description",
    val timeField: String = "pubDate",
    val linkField: String = "link",
    val refreshInterval: Int = 0, // seconds
    val headers: Map<String, String> = emptyMap() // custom headers, e.g. Authorization: Bearer <token>
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
                rssUrl = json.optString("rssUrl", ""),
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
            // PC puts the toggles at top level, properties is the legacy format
            MediaControlWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "Music Control"),
                displayMode = json.optString("displayMode", "always"),
                showCover = if (props?.has("showCover") == true) props.optBoolean("showCover", true)
                else json.optBoolean("showCover", true),
                showProgress = if (props?.has("showProgress") == true) props.optBoolean("showProgress", true)
                else json.optBoolean("showProgress", true)
            )
        } catch (e: Exception) {
            Log.w(WIDGET_TAG, "MediaControlWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}

/** media state pushed live from the PC; basePosition/baseSystemTime drive local progress interpolation */
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
            // toggles at top level, CPU is uppercase showCPU
            fun readBool(key: String, pcKey: String = key): Boolean =
                if (props?.has(key) == true) props.optBoolean(key, true)
                else if (json.has(pcKey)) json.optBoolean(pcKey, true)
                else true
            SystemMonitorWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                label = json.optString("label", "System Monitor"),
                showCpu = readBool("showCpu", "showCPU"),
                showMemory = readBool("showMemory"),
                showDisk = readBool("showDisk"),
                showNetwork = readBool("showNetwork"),
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
    val showWeekday: Boolean = false,     // weekday under the time
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
                // fields may live in properties or top level (PC usually top level)
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
                // showLunar is top level on the PC side
                showLunar = if (props?.has("showLunar") == true) props.optBoolean("showLunar", false)
                else json.optBoolean("showLunar", false)
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

/** info card: title/desc text + image + tags + footer text
 *  (PC fields: cardTitle/cardDesc/cardImage/cardImagePosition/cardTags[]/cardFooter) */
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

/** text snippet item inside a quick action cell */
data class QuickActionSnippetItem(
    val id: String = "",
    val label: String = "",
    val content: String = ""
)

/** single quick action cell: launcher (type/name/path) or snippet (type/title/snippets) */
data class QuickActionCell(
    val type: String, // "launcher" or "snippet"
    val name: String = "",
    val path: String = "",
    val title: String = "",
    val snippets: List<QuickActionSnippetItem> = emptyList()
)

/** quick action panel: 2x2 or custom grid of launcher/snippet cells (PC fields: columns, rows, cells[]) */
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
