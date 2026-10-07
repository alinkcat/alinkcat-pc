package com.ailinkcat.mobile.domain.models

import com.ailinkcat.mobile.BuildConfig
import com.ailinkcat.mobile.data.AuthApi
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/** configurable weather widget, fields map straight to the theme JSON.
 *  defaults to the self-hosted weather API (X-API-Key auth) where the theme only fills city
 *  and apiKey; legacy OpenWeatherMap direct mode still works */
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
    // response mapping (JMESPath)
    val responseMapping: Map<String, String> = emptyMap()
) : Widget() {
    companion object {
        private const val TAG = "WeatherWidget"
        /** default fallback city (data default, not UI copy; city list in CityOptions) */
        const val DEFAULT_CITY = "Beijing"
        /** legacy OpenWeatherMap direct url, supports ${city}/${apiKey} placeholders */
        const val OWM_URL = "https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${apiKey}&units=metric"

        /** self-hosted weather API, X-API-Key auth, returns wttr.in j1 format */
        const val AILINK_URL = "https://api.pynen.com/api/public/weather?q=\${city}&f=wttr"

        /** default response mapping for the self-hosted API (backend wttr.in j1 shape) */
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

        private val DEFAULT_AILINK_HEADERS = mapOf("X-API-Key" to "\${apiKey}")

        /** exact path-segment match for the weather api, avoids contains() false
         *  positives on custom paths; matches /api/weather/... and /api/public/weather */
        private fun isWeatherApiUrl(url: String): Boolean {
            val path = url.substringBefore('?').substringBefore('#')
            val segments = path.split('/').filter { it.isNotBlank() }
            if (segments.size >= 2 && segments[0] == "api" && segments[1] == "weather") return true
            if (segments.size >= 3 && segments[0] == "api" && segments[1] == "public" && segments[2] == "weather") return true
            return false
        }

        /**
         * normalize a legacy weather url to the backend /api/public/weather (wttr format).
         * debug keeps the theme's original host for LAN debugging, release goes to the cloud.
         * accepts g= or lng/lat params, falls back to [fallbackCity]; non-weather urls pass through
         */
        fun normalizeLegacyUrl(url: String, fallbackCity: String = DEFAULT_CITY): String {
            if (!isWeatherApiUrl(url)) return url
            val host = if (BuildConfig.DEBUG) {
                Regex("""^https?://[^/]+""").find(url)?.value ?: AuthApi.BASE_URL
            } else {
                AuthApi.BASE_URL
            }
            // coords: prefer g=<lng>,<lat>, fall back to lng=/lat= params
            val g = Regex("[?&]g=([^&]*)").find(url)?.groupValues?.get(1)
                ?.takeIf { it.isNotBlank() && !it.contains("\${") }
                ?: run {
                    val lng = Regex("[?&]lng=([^&]*)").find(url)?.groupValues?.get(1)
                    val lat = Regex("[?&]lat=([^&]*)").find(url)?.groupValues?.get(1)
                    if (lng != null && lat != null && lng.isNotBlank() && lat.isNotBlank()) "$lng,$lat" else null
                }
            if (g != null) return "$host/api/public/weather?g=$g&f=wttr"
            // city: q=/city= param (literal ${city} means not provided), else fallbackCity;
            // percent-encoded so spaces/cjk don't break the query
            val city = Regex("[?&](city|q)=([^&]*)").find(url)?.groupValues?.get(2)
                ?.takeIf { it.isNotBlank() && !it.startsWith("lng") && !it.contains("\${") }
                ?: fallbackCity.ifBlank { DEFAULT_CITY }
            return "$host/api/public/weather?q=${URLEncoder.encode(city, "UTF-8")}&f=wttr"
        }

        fun fromJson(json: JSONObject, layout: WidgetLayout, fallbackId: String = ""): WeatherWidget? = try {
            // requestHeaders support ${} placeholders
            val requestHeaders = mutableMapOf<String, String>()
            val headersObj = json.optJSONObject("requestHeaders")
            if (headersObj != null) {
                val keys = headersObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    // optString won't throw on numeric/bool values, so the widget doesn't get dropped
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
            // blank url, new api or legacy JWT endpoint all count as self-hosted;
            // same X-API-Key auth for debug/release, only the host differs
            val rawUrl = json.optString("requestUrl")
            val url = if (rawUrl.isBlank()) AILINK_URL else WeatherWidget.normalizeLegacyUrl(rawUrl)
            val isDefaultAilink = WeatherWidget.isWeatherApiUrl(url)
            // self-hosted API always gets the X-API-Key header, custom headers merge on top
            val effectiveHeaders = if (isDefaultAilink) {
                val merged = requestHeaders.toMutableMap()
                if (!merged.containsKey("X-API-Key")) {
                    merged.putAll(DEFAULT_AILINK_HEADERS)
                }
                merged
            } else {
                requestHeaders
            }
            // refreshHours < 1 is invalid, fall back to 1.0
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
                // default mapping when the theme didn't configure one
                responseMapping = if (isDefaultAilink && mapping.isEmpty()) DEFAULT_AILINK_MAPPING else mapping
            )
        } catch (e: Exception) {
            Log.w(TAG, "WeatherWidget.fromJson failed, id=${json.optString("id")}", e)
            null
        }
    }
}
