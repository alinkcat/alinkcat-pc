package com.ailinkcat.mobile.domain.models

import org.json.JSONArray
import org.json.JSONObject

/**
 * 可配置的天气组件模型。
 * 所有字段直接映射自主题 JSON，保持与 PC 端的 WeatherWidget 配置一致。
 */
data class WeatherWidget(
    override val id: String,
    override val type: WidgetType = WidgetType.WEATHER,
    override val layout: WidgetLayout,
    // 请求配置
    val requestUrl: String,
    val requestMethod: String = "GET",
    val requestHeaders: Map<String, String> = emptyMap(),
    val requestBody: String? = null,
    // 基础参数
    val city: String = "",
    val apiKey: String = "",
    val extraParams: Map<String, String> = emptyMap(),
    val unit: String = "c",
    val refreshHours: Double = 1.0,
    // 响应映射（JMESPath 表达式）
    val responseMapping: Map<String, String> = emptyMap()
) : Widget() {
    companion object {
        /** 与 PC 端一致的 OpenWeatherMap 默认请求地址（支持 ${city} / ${apiKey} 占位符） */
        const val OWM_URL = "https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}&units=metric"

        fun fromJson(json: JSONObject, layout: WidgetLayout): WeatherWidget? = try {
            // 读取请求相关字段（均支持占位符）
            val requestHeaders = mutableMapOf<String, String>()
            val headersObj = json.optJSONObject("requestHeaders")
            if (headersObj != null) {
                val keys = headersObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    requestHeaders[k] = headersObj.getString(k)
                }
            }
            // 读取 extraParams（可选）
            val extra = mutableMapOf<String, String>()
            val extraObj = json.optJSONObject("extraParams")
            if (extraObj != null) {
                val keys = extraObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    extra[k] = extraObj.getString(k)
                }
            }
            // 读取 responseMapping
            val mapping = mutableMapOf<String, String>()
            val mapObj = json.optJSONObject("responseMapping")
            if (mapObj != null) {
                val keys = mapObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    mapping[k] = mapObj.getString(k)
                }
            }
            WeatherWidget(
                id = json.getString("id"),
                layout = layout,
                requestUrl = json.optString("requestUrl").ifBlank { OWM_URL },
                requestMethod = json.optString("requestMethod", "GET"),
                requestHeaders = requestHeaders,
                requestBody = json.optString("requestBody").ifBlank { null },
                city = json.optString("city", ""),
                apiKey = json.optString("apiKey", ""),
                extraParams = extra,
                unit = json.optString("unit", "c"),
                refreshHours = json.optDouble("refreshHours", 1.0),
                responseMapping = mapping
            )
        } catch (_: Exception) {
            null
        }
    }
}
