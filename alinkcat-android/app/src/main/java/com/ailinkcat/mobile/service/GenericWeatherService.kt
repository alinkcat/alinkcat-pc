package com.ailinkcat.mobile.service

import com.ailinkcat.mobile.util.JsonPath
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * 把 widget JSON 中的请求配置转成 WeatherInfo DTO：经 GenericHttpService 发请求，按映射路径抽取字段。
 */
object GenericWeatherService {
    data class WeatherWidgetConfig(
        val requestUrl: String,
        val requestMethod: String = "GET",
        val requestHeaders: Map<String, String>? = null,
        val requestBody: String? = null,
        val city: String,
        val apiKey: String,
        val extraParams: Map<String, String>? = null,
        val responseMapping: ResponseMapping,
        val refreshHours: Double = 1.0
    )

    data class ResponseMapping(
        val city: String?,
        val temp: String?,
        val condition: String?,
        val description: String?,
        val icon: String?,
        val humidity: String?,
        val wind_speed: String?,
        val feels_like: String?,
        val forecastPath: String?
    )

    data class WeatherInfo(
        val city: String,
        val temp: Double,
        val condition: String,
        val description: String,
        val icon: String,
        val humidity: Int,
        val wind_speed: Double,
        val feels_like: Double,
        val forecast: List<ForecastDay>
    )

    data class ForecastDay(
        val date: String,
        val temp_max: Double,
        val temp_min: Double,
        val condition: String,
        val icon: String
    )

    suspend fun fetchWeather(config: WeatherWidgetConfig): WeatherInfo = withContext(Dispatchers.IO) {
        // 1. 渲染占位符
        val vars = mutableMapOf<String, String>("city" to config.city, "apiKey" to config.apiKey)
        config.extraParams?.forEach { (k, v) -> vars[k] = v }
        fun render(tpl: String): String = tpl.replace(Regex("\$\\{([^}]+)}")) { match ->
            vars[match.groupValues[1].trim()] ?: ""
        }
        // URL 占位符值做百分号编码，避免中文等非 ASCII 字符破坏 URL
        fun renderUrl(tpl: String): String = tpl.replace(Regex("\$\\{([^}]+)}")) { match ->
            val v = vars[match.groupValues[1].trim()] ?: ""
            URLEncoder.encode(v, "UTF-8")
        }
        val url = renderUrl(config.requestUrl)
        val headers = config.requestHeaders?.mapValues { (_, v) -> render(v) } ?: emptyMap()
        val body = config.requestBody?.let { render(it) }

        // 2. 发请求
        val raw: JSONObject = GenericHttpService.request(
            url = url,
            method = config.requestMethod,
            headers = headers,
            body = body
        )

        // 3. 映射字段
        val map = config.responseMapping
        // wttr.in j1 的数字字段是字符串（如 "27"），统一兼容 Number / String / JSONArray{value}
        fun jsonToNumber(v: Any?): Double? = when (v) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull()
            is JSONArray -> v.optJSONObject(0)?.optString("value")?.toDoubleOrNull()
            else -> null
        }
        fun jsonToString(v: Any?): String? = when (v) {
            is String -> v
            is Number -> v.toString()
            is JSONArray -> v.optJSONObject(0)?.optString("value")?.takeIf { it.isNotBlank() }
            else -> null
        }
        fun getNum(path: String?): Double? = path?.let { jsonToNumber(JsonPath.get(raw, it)) }
        fun getStr(path: String?): String? = path?.let { jsonToString(JsonPath.get(raw, it)) }
        val forecastList = mutableListOf<ForecastDay>()
        val forecastArray = map.forecastPath?.let { JsonPath.get(raw, it) as? JSONArray }
        if (forecastArray != null) {
            for (i in 0 until forecastArray.length()) {
                // optJSONObject：坏项跳过，不影响整条预报
                val obj = forecastArray.optJSONObject(i) ?: continue
                // 字段名兼容：maxtempC/mintempC、tempMax/tempMin、temp_max/temp_min
                var condition = obj.optString("weather", obj.optString("condition", ""))
                var icon = obj.optString("icon", "")
                // wttr 的 condition/icon 在 hourly[0]（weatherDesc / weatherCode）
                val hourly = obj.optJSONArray("hourly")
                if (hourly != null && hourly.length() > 0) {
                    val h0 = hourly.optJSONObject(0) ?: continue
                    if (condition.isBlank()) {
                        condition = h0.optJSONArray("weatherDesc")?.optJSONObject(0)?.optString("value") ?: ""
                    }
                    if (icon.isBlank()) {
                        icon = when (val code = h0.opt("weatherCode")) {
                            is Int -> code.toString()
                            is Long -> code.toString()
                            is Double -> code.toInt().toString()
                            else -> code?.toString() ?: ""
                        }
                    }
                }
                forecastList.add(
                    ForecastDay(
                        date = obj.optString("date", ""),
                        temp_max = obj.optDouble("maxtempC", obj.optDouble("tempMax", obj.optDouble("temp_max", 0.0))),
                        temp_min = obj.optDouble("mintempC", obj.optDouble("tempMin", obj.optDouble("temp_min", 0.0))),
                        condition = condition,
                        icon = icon
                    )
                )
            }
        }
        WeatherInfo(
            city = getStr(map.city) ?: "",
            temp = getNum(map.temp) ?: 0.0,
            condition = getStr(map.condition) ?: "",
            description = getStr(map.description) ?: "",
            icon = getStr(map.icon) ?: "",
            humidity = getNum(map.humidity)?.toInt() ?: 0,
            wind_speed = getNum(map.wind_speed) ?: 0.0,
            feels_like = getNum(map.feels_like) ?: 0.0,
            forecast = forecastList
        )
    }
}
