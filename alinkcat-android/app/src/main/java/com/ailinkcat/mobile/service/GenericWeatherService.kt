package com.ailinkcat.mobile.service

import com.ailinkcat.mobile.util.JsonPath
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * 负责把用户在 widget JSON 中配置的请求细节转成统一的 WeatherInfo DTO。
 * 通过 GenericHttpService 发送请求，然后依据用户提供的映射路径抽取字段。
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
        // 1️⃣ 渲染占位符
        val vars = mutableMapOf<String, String>("city" to config.city, "apiKey" to config.apiKey)
        config.extraParams?.forEach { (k, v) -> vars[k] = v }
        fun render(tpl: String): String = tpl.replace(Regex("\$\\{([^}]+)}")) { match ->
            vars[match.groupValues[1].trim()] ?: ""
        }
        // URL 中的占位符值做百分号编码，避免中文城市等非 ASCII 字符导致请求失败
        fun renderUrl(tpl: String): String = tpl.replace(Regex("\$\\{([^}]+)}")) { match ->
            val v = vars[match.groupValues[1].trim()] ?: ""
            URLEncoder.encode(v, "UTF-8")
        }
        val url = renderUrl(config.requestUrl)
        val headers = config.requestHeaders?.mapValues { (_, v) -> render(v) } ?: emptyMap()
        val body = config.requestBody?.let { render(it) }

        // 2️⃣ 发请求
        val raw: JSONObject = GenericHttpService.request(
            url = url,
            method = config.requestMethod,
            headers = headers,
            body = body
        )

        // 3️⃣ 映射字段
        val map = config.responseMapping
        fun <T> get(path: String?): T? = path?.let { JsonPath.get(raw, it) as? T }
        val forecastList = mutableListOf<ForecastDay>()
        val forecastArray = get<JSONArray>(map.forecastPath)
        if (forecastArray != null) {
            for (i in 0 until forecastArray.length()) {
                val obj = forecastArray.getJSONObject(i)
                // 这里假设用户已经在映射里把 forecast 的每个字段映射成相对路径
                // 为简化，仅直接读取常见字段名，若不存在则回退空值
                forecastList.add(
                    ForecastDay(
                        date = obj.optString("date", ""),
                        temp_max = obj.optDouble("temp_max"),
                        temp_min = obj.optDouble("temp_min"),
                        condition = obj.optString("condition", ""),
                        icon = obj.optString("icon", "")
                    )
                )
            }
        }
        WeatherInfo(
            city = get<String>(map.city) ?: "",
            temp = (get<Number>(map.temp)?.toDouble()) ?: 0.0,
            condition = get<String>(map.condition) ?: "",
            description = get<String>(map.description) ?: "",
            icon = get<String>(map.icon) ?: "",
            humidity = (get<Number>(map.humidity)?.toInt()) ?: 0,
            wind_speed = (get<Number>(map.wind_speed)?.toDouble()) ?: 0.0,
            feels_like = (get<Number>(map.feels_like)?.toDouble()) ?: 0.0,
            forecast = forecastList
        )
    }
}
