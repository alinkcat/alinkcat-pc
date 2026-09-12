package com.ailinkcat.mobile.domain.models

import com.ailinkcat.mobile.BuildConfig
import com.ailinkcat.mobile.data.AuthApi
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/**
 * 可配置的天气组件模型，字段直接映射主题 JSON。
 * 默认走自建天气 API（AILINK_URL，X-API-Key 鉴权），响应映射已预设，主题只需填 city 和 apiKey。
 * 兼容旧版 OpenWeatherMap（OWM_URL）直连模式。
 */
data class WeatherWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.WEATHER,
    override val layout: WidgetLayout,
    val requestUrl: String,
    val requestMethod: String = "GET",
    val requestHeaders: Map<String, String> = emptyMap(),
    val requestBody: String? = null,
    val city: String = "",
    val apiKey: String = "",
    val extraParams: Map<String, String> = emptyMap(),
    val unit: String = "c",
    val refreshHours: Double = 1.0,
    // 响应映射（JMESPath 表达式）
    val responseMapping: Map<String, String> = emptyMap()
) : Widget() {
    companion object {
        private const val TAG = "WeatherWidget"
        /** 兼容旧版 OpenWeatherMap 直连地址（支持 ${city} / ${apiKey} 占位符） */
        const val OWM_URL = "https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}&units=metric"

        /** 自建天气 API 地址（免登录，X-API-Key 鉴权，返回 wttr.in j1 格式） */
        const val AILINK_URL = "https://top.atqx.cn/api/public/weather?q=\${city}&f=wttr"

        /** 自建 API 的默认响应映射（适配后端返回的 wttr.in j1 结构） */
        private val DEFAULT_AILINK_MAPPING = mapOf(
            "city" to "nearest_area[0].areaName[0].value",
            "temp" to "current_condition[0].temp_C",
            "condition" to "current_condition[0].weatherDesc[0].value",
            "description" to "current_condition[0].weatherDesc[0].value",
            "icon" to "current_condition[0].weatherCode",
            "humidity" to "current_condition[0].humidity",
            "wind_speed" to "current_condition[0].windspeedKmph",
            "feels_like" to "current_condition[0].FeelsLikeC",
            "forecast" to "weather"
        )

        /** 自建 API 的默认请求头 */
        private val DEFAULT_AILINK_HEADERS = mapOf("X-API-Key" to "\${apiKey}")

        /**
         * 按路径段精确判定天气接口，避免 `contains("api/weather/")` 误伤自定义路径。
         * 匹配 `/api/weather/...` 与 `/api/public/weather` 两种规范路径。
         */
        private fun isWeatherApiUrl(url: String): Boolean {
            val path = url.substringBefore('?').substringBefore('#')
            val segments = path.split('/').filter { it.isNotBlank() }
            if (segments.size >= 2 && segments[0] == "api" && segments[1] == "weather") return true
            if (segments.size >= 3 && segments[0] == "api" && segments[1] == "public" && segments[2] == "weather") return true
            return false
        }

        /**
         * 天气接口 URL 归一化：统一指向后端 /api/public/weather（wttr 格式）。
         * 后端接口规范：GET {host}/api/public/weather?g=<lng>,<lat>&f=wttr，header X-API-Key，返回 wttr.in j1 格式。
         * debug 保留主题原始 host（局域网联调），release 统一云端 https://top.atqx.cn。
         * 定位后 URL 可能已含 g= / lng / lat 参数；无定位时用 [fallbackCity] 兜底；非天气接口原样返回。
         */
        fun normalizeLegacyUrl(url: String, fallbackCity: String = "北京"): String {
            if (!isWeatherApiUrl(url)) return url
            // host：debug 保留局域网，release 用云端；默认统一为 AuthApi.BASE_URL
            val host = if (BuildConfig.DEBUG) {
                Regex("""^https?://[^/]+""").find(url)?.value ?: AuthApi.BASE_URL
            } else {
                AuthApi.BASE_URL
            }
            // 经纬度：优先 g=<lng>,<lat>，其次 lng=/lat= 参数
            val g = Regex("[?&]g=([^&]*)").find(url)?.groupValues?.get(1)
                ?.takeIf { it.isNotBlank() && !it.contains("\${") }
                ?: run {
                    val lng = Regex("[?&]lng=([^&]*)").find(url)?.groupValues?.get(1)
                    val lat = Regex("[?&]lat=([^&]*)").find(url)?.groupValues?.get(1)
                    if (lng != null && lat != null && lng.isNotBlank() && lat.isNotBlank()) "$lng,$lat" else null
                }
            if (g != null) return "$host/api/public/weather?g=$g&f=wttr"
            // 城市兜底：q= / city= 参数（字面 ${city} 视为未提供），否则 fallbackCity
            // 百分号编码，避免中文/空格破坏 query
            val city = Regex("[?&](city|q)=([^&]*)").find(url)?.groupValues?.get(2)
                ?.takeIf { it.isNotBlank() && !it.startsWith("lng") && !it.contains("\${") }
                ?: fallbackCity.ifBlank { "北京" }
            return "$host/api/public/weather?q=${URLEncoder.encode(city, "UTF-8")}&f=wttr"
        }

        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): WeatherWidget? = try {
            // requestHeaders 支持 ${} 占位符
            val requestHeaders = mutableMapOf<String, String>()
            val headersObj = json.optJSONObject("requestHeaders")
            if (headersObj != null) {
                val keys = headersObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    // optString：数字/布尔等非字符串值不抛异常，避免控件被吞成 null
                    requestHeaders[k] = headersObj.optString(k)
                }
            }
            val extra = mutableMapOf<String, String>()
            val extraObj = json.optJSONObject("extraParams")
            if (extraObj != null) {
                val keys = extraObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    extra[k] = extraObj.optString(k)
                }
            }
            val mapping = mutableMapOf<String, String>()
            val mapObj = json.optJSONObject("responseMapping")
            if (mapObj != null) {
                val keys = mapObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    mapping[k] = mapObj.optString(k)
                }
            }
            // 未指定 URL / 新版接口 / 旧版 JWT 接口都算自建 API
            // debug/release 同一鉴权（X-API-Key），仅 host 不同
            val rawUrl = json.optString("requestUrl")
            val url = if (rawUrl.isBlank()) AILINK_URL else WeatherWidget.normalizeLegacyUrl(rawUrl)
            val isDefaultAilink = WeatherWidget.isWeatherApiUrl(url)
            // 自建 API 始终注入默认请求头（X-API-Key），自定义头在其基础上合并
            val effectiveHeaders = if (isDefaultAilink) {
                val merged = requestHeaders.toMutableMap()
                // 已有 X-API-Key 则保留，否则注入默认占位符
                if (!merged.containsKey("X-API-Key")) {
                    merged.putAll(DEFAULT_AILINK_HEADERS)
                }
                merged
            } else {
                requestHeaders
            }
            // refreshHours <1 视为无效，回退默认 1.0
            val refreshHours = json.optDouble("refreshHours", 1.0).takeIf { it >= 1.0 } ?: 1.0
            WeatherWidget(
                id = json.optString("id", "").ifBlank { fallbackId },
                layout = layout,
                requestUrl = url,
                requestMethod = json.optString("requestMethod", "GET"),
                requestHeaders = effectiveHeaders,
                requestBody = json.optString("requestBody").ifBlank { null },
                city = json.optString("city", ""),
                apiKey = json.optString("apiKey", ""),
                extraParams = extra,
                unit = json.optString("unit", "c"),
                refreshHours = refreshHours,
                // 自建 API 未配置映射时用默认映射
                responseMapping = if (isDefaultAilink && mapping.isEmpty()) DEFAULT_AILINK_MAPPING else mapping
            )
        } catch (e: Exception) {
            Log.w(TAG, "WeatherWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}
