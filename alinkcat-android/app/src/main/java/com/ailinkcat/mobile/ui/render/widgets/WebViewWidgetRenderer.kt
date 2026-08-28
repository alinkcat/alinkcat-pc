package com.ailinkcat.mobile.ui.render.widgets

import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.ailinkcat.mobile.domain.models.WebViewWidget
import com.ailinkcat.mobile.service.GenericHttpService
import com.ailinkcat.mobile.util.JsonPath
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONArray
import org.json.JSONObject

/**
 * WebView 控件：
 * - 默认模式加载 URL 网页
 * - displayMode = json 时，抓取 jsonUrl 并展示数据；若为天气结构（wttr.in / OpenWeatherMap）
 *   则渲染可视化天气仪表盘，否则渲染通用列表（对象 → 键值对，数组 → 条目卡片）。
 *   支持按 refreshInterval 自动刷新，与 PC 端 WebViewJSON 行为一致。
 */
@Composable
fun WebViewWidgetRenderer(widget: WebViewWidget) {
    if (widget.displayMode.equals("json", ignoreCase = true)) {
        JsonDataRenderer(widget)
        return
    }

    val url = widget.url
    if (url.isNullOrBlank()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF222222)),
            contentAlignment = Alignment.Center
        ) {
            Text("🔗", fontSize = 24.sp, color = Color.Gray)
        }
        return
    }

    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort = true
                webViewClient = WebViewClient()
                loadUrl(url)
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

/**
 * JSON 数据缓存：页面来回切换（组件销毁重建）时不重复请求，
 * 仅当数据超过刷新周期（TTL）才重新拉取。
 */
private object JsonDataCache {
    private val cache = HashMap<String, Pair<Any?, Long>>()
    fun get(url: String, ttlMs: Long): Any? {
        val pair = cache[url] ?: return null
        return if (System.currentTimeMillis() - pair.second < ttlMs) pair.first else null
    }
    fun put(url: String, data: Any?) {
        cache[url] = data to System.currentTimeMillis()
    }
}

@Composable
private fun JsonDataRenderer(widget: WebViewWidget) {
    val jsonUrl = widget.jsonUrl
    var data by remember { mutableStateOf<Any?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val refreshSec = widget.refreshInterval

    LaunchedEffect(jsonUrl) {
        suspend fun load() {
            loading = true
            error = null
            try {
                val text = GenericHttpService.requestText(jsonUrl, "GET", emptyMap(), null)
                data = parseJson(text)
                JsonDataCache.put(jsonUrl, data)
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
        // 命中缓存且未超过刷新周期 → 直接展示，避免翻页/重挂载重复请求
        val ttlMs = if (refreshSec > 0) refreshSec * 1000L else 3600_000L
        JsonDataCache.get(jsonUrl, ttlMs)?.let { data = it }
        if (data == null) load()
        if (refreshSec > 0) {
            while (isActive) {
                delay(refreshSec * 1000L)
                load()
            }
        }
    }

    if (jsonUrl.isBlank()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🔗", fontSize = 28.sp, color = Color.Gray)
                Text("请在编辑器中配置 JSON 地址", fontSize = 12.sp, color = Color.Gray)
            }
        }
        return
    }

    when {
        loading && data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("⏳", fontSize = 24.sp)
        }
        error != null && data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("❌ $error", fontSize = 11.sp, color = Color(0xFFFF6B6B))
        }
        data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("无数据", fontSize = 12.sp, color = Color.Gray)
        }
        else -> JsonContent(data!!, widget)
    }
}

@Composable
private fun JsonContent(data: Any, widget: WebViewWidget) {
    // 天气结构（wttr.in / OpenWeatherMap）→ 可视化天气仪表盘
    extractWeather(data)?.let { weather ->
        WeatherDashboard(weather)
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        when (data) {
            is JSONArray -> {
                if (data.length() == 0) {
                    EmptyText("无数据")
                } else {
                    for (i in 0 until data.length()) {
                        val item = data.optJSONObject(i)
                        if (item != null) {
                            JsonItemCard(item, widget)
                        } else {
                            JsonKvRow((i + 1).toString(), data.opt(i)?.toString() ?: "")
                        }
                    }
                }
            }
            is JSONObject -> {
                val keys = data.keys().asSequence().toList()
                if (keys.isEmpty()) {
                    EmptyText("无数据")
                } else {
                    keys.forEach { k ->
                        val v = data.opt(k)
                        JsonKvRow(k, if (v is JSONObject || v is JSONArray) v.toString() else v?.toString() ?: "")
                    }
                }
            }
            else -> JsonKvRow("data", data.toString())
        }
    }
}

@Composable
private fun JsonItemCard(item: JSONObject, widget: WebViewWidget) {
    val title = JsonPath.get(item, widget.titleField)?.toString() ?: "条目"
    val desc = JsonPath.get(item, widget.descField)?.toString() ?: ""
    val time = JsonPath.get(item, widget.timeField)?.toString() ?: ""
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.85f))
            .padding(horizontal = 8.dp, vertical = 6.dp)
    ) {
        Text(
            text = title,
            color = Color(0xFF1A1A2E),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (time.isNotBlank()) {
            Text(text = time, color = Color(0xFF888888), fontSize = 10.sp)
        }
        if (desc.isNotBlank()) {
            Text(
                text = desc,
                color = Color(0xFF333333),
                fontSize = 11.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun JsonKvRow(key: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(Color.White.copy(alpha = 0.85f))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = key,
            color = Color(0xFF666666),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.width(96.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = value,
            color = Color(0xFF1A1A2E),
            fontSize = 11.sp,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun EmptyText(text: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = text, fontSize = 12.sp, color = Color.Gray)
    }
}

private fun parseJson(text: String): Any? = try {
    JSONObject(text)
} catch (_: Exception) {
    try {
        JSONArray(text)
    } catch (_: Exception) {
        null
    }
}

// ─────────────────────────── 天气数据可视化 ───────────────────────────

private data class WeatherForecastDay(
    val date: String,
    val max: Double?,
    val min: Double?,
    val icon: String
)

private data class WeatherData(
    val temp: Double?,
    val feels: Double?,
    val humidity: Int?,
    val windSpeed: Double?, // km/h
    val windDir: String?,
    val desc: String,
    val icon: String,
    val city: String?,
    val forecast: List<WeatherForecastDay>
)

/** wttr.in 使用的 Met Office 天气代码 → emoji */
private val CODE_ICONS: Map<Int, String> = mapOf(
    113 to "☀️", 116 to "⛅", 119 to "☁️", 122 to "☁️", 143 to "🌫️",
    176 to "🌦️", 179 to "🌨️", 182 to "🌧️", 185 to "🌧️", 200 to "⛈️",
    227 to "❄️", 230 to "❄️", 248 to "🌫️", 260 to "🌫️", 263 to "🌧️",
    266 to "🌧️", 281 to "🌧️", 284 to "🌧️", 293 to "🌧️", 296 to "🌧️",
    299 to "🌧️", 302 to "🌧️", 305 to "🌧️", 308 to "🌧️", 311 to "🌧️",
    314 to "🌧️", 317 to "🌨️", 320 to "🌨️", 323 to "❄️", 326 to "❄️",
    329 to "❄️", 332 to "❄️", 335 to "❄️", 338 to "❄️", 350 to "🧊",
    353 to "🌦️", 356 to "🌧️", 359 to "🌧️", 362 to "🌨️", 365 to "🌨️",
    368 to "❄️", 371 to "❄️", 374 to "🌨️", 377 to "🌨️", 386 to "⛈️",
    389 to "⛈️", 392 to "⛈️", 395 to "❄️"
)

private fun weatherIconFor(code: Int?, desc: String): String {
    if (code != null) {
        CODE_ICONS[code]?.let { return it }
    }
    val d = desc.lowercase()
    return when {
        d.contains("sun") || d.contains("clear") -> "☀️"
        d.contains("thunder") -> "⛈️"
        d.contains("snow") || d.contains("blizzard") || d.contains("sleet") -> "❄️"
        d.contains("rain") || d.contains("drizzle") || d.contains("shower") -> "🌧️"
        d.contains("fog") || d.contains("mist") -> "🌫️"
        d.contains("cloud") || d.contains("overcast") -> "☁️"
        else -> "🌤️"
    }
}

/** 从 [{ "value": "113" }] 结构提取天气代码 */
private fun weatherCodeOf(holder: Any?): Int? = when (holder) {
    is JSONArray -> holder.optJSONObject(0)?.optString("value")?.toIntOrNull()
    else -> null
}

private fun toDoubleOrNull(v: Any?): Double? = when (v) {
    is Double -> v
    is Int -> v.toDouble()
    is Long -> v.toDouble()
    is Number -> v.toDouble()
    is String -> v.toDoubleOrNull()
    else -> null
}

private fun toIntOrNull(v: Any?): Int? = when (v) {
    is Int -> v
    is Number -> v.toInt()
    is String -> v.toIntOrNull()
    else -> null
}

/** 从任意 JSON 中提取天气数据；非天气结构返回 null（与 PC 端 weatherJson.ts 逻辑一致） */
private fun extractWeather(data: Any?): WeatherData? {
    if (data !is JSONObject) return null

    // wttr.in j1 格式
    val ccArr = data.optJSONArray("current_condition")
    if (ccArr != null && ccArr.length() > 0) {
        val cc = ccArr.getJSONObject(0)
        val desc = cc.optJSONArray("weatherDesc")?.optJSONObject(0)?.optString("value") ?: ""
        val code = weatherCodeOf(cc.opt("weatherCode") ?: cc.opt("weathercode"))
        val city = data.optJSONArray("nearest_area")
            ?.optJSONObject(0)?.optJSONArray("areaName")?.optJSONObject(0)?.optString("value")
        val forecast = buildList {
            val wArr = data.optJSONArray("weather") ?: return@buildList
            for (i in 0 until minOf(wArr.length(), 3)) {
                val d = wArr.getJSONObject(i)
                val hourly = d.optJSONArray("hourly")
                // 取中午（第 7 个点）的天气代码作代表
                val noon = hourly?.takeIf { it.length() > 6 }?.optJSONObject(6)
                val noonCode = noon?.let {
                    weatherCodeOf(it.opt("weatherCode") ?: it.opt("weathercode"))
                }
                add(
                    WeatherForecastDay(
                        date = d.optString("date", ""),
                        max = d.optString("maxtempC").toDoubleOrNull() ?: d.optString("tempMaxC").toDoubleOrNull(),
                        min = d.optString("mintempC").toDoubleOrNull() ?: d.optString("tempMinC").toDoubleOrNull(),
                        icon = weatherIconFor(noonCode, "")
                    )
                )
            }
        }
        return WeatherData(
            temp = cc.optString("temp_C").toDoubleOrNull(),
            feels = toDoubleOrNull(cc.opt("FeelsLikeC") ?: cc.opt("feelsLikeC")),
            humidity = toIntOrNull(cc.opt("humidity")),
            windSpeed = cc.optString("windspeedKmph").toDoubleOrNull(),
            windDir = cc.optString("winddir16Point").ifBlank { null },
            desc = desc,
            icon = weatherIconFor(code, desc),
            city = city,
            forecast = forecast
        )
    }

    // OpenWeatherMap 格式
    val main = data.optJSONObject("main")
    if (main != null && main.has("temp")) {
        val w0 = data.optJSONArray("weather")?.optJSONObject(0)
        val desc = w0?.optString("description") ?: ""
        val wind = data.optJSONObject("wind")
        return WeatherData(
            temp = toDoubleOrNull(main.opt("temp")),
            feels = toDoubleOrNull(main.opt("feels_like")),
            humidity = toIntOrNull(main.opt("humidity")),
            windSpeed = toDoubleOrNull(wind?.opt("speed")),
            windDir = null,
            desc = desc,
            icon = weatherIconFor(w0?.optInt("id", -1)?.takeIf { it > 0 }, desc),
            city = data.optString("name").ifBlank { null },
            forecast = emptyList()
        )
    }

    return null
}

@Composable
private fun WeatherDashboard(w: WeatherData) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // 顶部：城市 + 图标
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = w.city ?: "天气",
                color = Color(0xFF1A1A2E),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.width(6.dp))
            Text(text = w.icon, fontSize = 30.sp)
        }

        // 温度
        Text(
            text = if (w.temp != null) "${w.temp.roundToInt()}°C" else "--",
            color = Color(0xFF1A1A2E),
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        // 天气描述
        Text(
            text = w.desc,
            color = Color(0xFF666666),
            fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        // 详情行：湿度 / 风 / 体感
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            WeatherDetail("💧", if (w.humidity != null) "${w.humidity}%" else "--")
            WeatherDetail(
                "🌬️",
                if (w.windSpeed != null) {
                    "${w.windSpeed.roundToInt()} km/h${w.windDir?.let { " $it" } ?: ""}"
                } else "--"
            )
            WeatherDetail("🌡️", if (w.feels != null) "${w.feels.roundToInt()}°" else "--")
        }

        // 未来 3 天预报
        if (w.forecast.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                w.forecast.forEach { day ->
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White.copy(alpha = 0.7f))
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = day.date.takeLast(5),
                            color = Color(0xFF888888),
                            fontSize = 10.sp
                        )
                        Text(text = day.icon, fontSize = 22.sp)
                        Text(
                            text = "${day.max?.roundToInt() ?: "--"}° / ${day.min?.roundToInt() ?: "--"}°",
                            color = Color(0xFF333333),
                            fontSize = 10.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WeatherDetail(emoji: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = emoji, fontSize = 16.sp)
        Text(text = value, color = Color(0xFF333333), fontSize = 10.sp)
    }
}
