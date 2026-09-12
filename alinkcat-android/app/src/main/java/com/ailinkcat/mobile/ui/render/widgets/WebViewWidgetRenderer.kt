package com.ailinkcat.mobile.ui.render.widgets

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.ui.platform.LocalContext
import android.content.Context
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.BuildConfig
import com.ailinkcat.mobile.data.AuthApi
import com.ailinkcat.mobile.data.DataStoreManager
import com.ailinkcat.mobile.data.model.StoredConfig
import com.ailinkcat.mobile.domain.models.WeatherWidget
import com.ailinkcat.mobile.domain.models.WebViewWidget
import com.ailinkcat.mobile.service.GenericHttpService
import com.ailinkcat.mobile.util.JsonPath
import com.ailinkcat.mobile.util.LocationUtil
import kotlin.math.roundToInt
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
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
        modifier = Modifier.fillMaxSize(),
        // 组件销毁时释放 WebView：先移除子 View 再 destroy，杜绝 WebView 泄漏
        onRelease = { webView ->
            webView.removeAllViews()
            webView.destroy()
        }
    )
}

/**
 * JSON 数据缓存：页面来回切换（组件销毁重建）时不重复请求，
 * 仅当数据超过刷新周期（TTL）才重新拉取。
 * - 有界：最多保留 [MAX_ENTRIES] 项，超出后淘汰最旧条目，防止内存无限增长；
 * - 键含 widget.id 前缀：不同主题的 widget id 不同，按主题/控件隔离，避免跨主题串数据。
 */
private object JsonDataCache {
    private const val MAX_ENTRIES = 32
    private val cache = LinkedHashMap<String, Pair<Any?, Long>>()

    fun get(key: String, ttlMs: Long): Any? {
        val pair = cache[key] ?: return null
        return if (System.currentTimeMillis() - pair.second < ttlMs) pair.first else null
    }

    fun put(key: String, data: Any?) {
        cache[key] = data to System.currentTimeMillis()
        // 有界淘汰：超出上限移除最旧条目
        while (cache.size > MAX_ENTRIES) {
            val oldest = cache.keys.firstOrNull() ?: break
            cache.remove(oldest)
        }
    }
}

/**
 * 主题包中 WebView(json) 组件的 jsonUrl 常由 PC 编辑器写死为开发环境局域网地址
 * （如 http://192.168.6.144:8080）。debug 构建保留原样便于连本地后端调试；
 * release 构建自动把局域网 IP 地址替换为单一 host 常量 AuthApi.BASE_URL（生产域名），
 * 避免打包后接口仍指向局域网导致无法访问。
 * 注意：天气接口不在此重写——其 host/路径由 WeatherWidget.normalizeLegacyUrl 统一处理，
 * 两个重写只取其一，避免叠加。
 */
private fun resolveThemeJsonUrl(raw: String): String {
    if (BuildConfig.DEBUG) return raw
    return raw.replace(
        Regex("""^http://\d{1,3}(\.\d{1,3}){3}(:\d+)?"""),
        AuthApi.BASE_URL
    )
}

/** 判断是否为自建天气 API URL（与 WeatherWidget.normalizeLegacyUrl 的判定一致） */
private fun String.isWeatherApiUrl(): Boolean =
    contains("api/public/weather") || contains("api/weather/mobile") || contains("api/weather/")

/**
 * 匹配 query 参数形式的城市参数：city / q / cityName / city_name，
 * 值可为百分号编码（如 q=%E5%8C%97%E4%BA%AC），分隔符兼容 = 与编码 %3D。
 * 替代原先仅认字面 "city="/"q=" 的 contains 判断（无法命中 cityName 等别名，且可能误伤路径段）。
 */
private val CITY_QUERY_PARAM =
    Regex("""[?&](?:city|q|cityname|city_name)(?:=|%3D)[^&#]*""", RegexOption.IGNORE_CASE)

private fun hasCityQuery(url: String): Boolean = CITY_QUERY_PARAM.containsMatchIn(url)

@Composable
private fun JsonDataRenderer(widget: WebViewWidget) {
    // host 只做一次重写：天气接口交给 WeatherWidget.normalizeLegacyUrl 统一处理（避免两套 host 重写叠加），
    // 非天气 JSON 接口在 release 下由 resolveThemeJsonUrl 按单一 host 常量 AuthApi.BASE_URL 重写。
    val rawJsonUrl = widget.jsonUrl
    val jsonUrl = if (rawJsonUrl.isWeatherApiUrl()) rawJsonUrl else resolveThemeJsonUrl(rawJsonUrl)
    var data by remember { mutableStateOf<Any?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    // 已登录时用 App 的 accessToken 覆盖主题里的占位请求头，实现 JWT 鉴权
    val appContext = LocalContext.current.applicationContext
    val dataStore = remember { DataStoreManager(appContext) }
    val config by dataStore.config.collectAsStateWithLifecycle(initialValue = StoredConfig())
    // 用户设置的天气刷新间隔（秒）；>0 覆盖主题 refreshInterval
    val refreshSec = if (config.weatherRefreshSeconds > 0) config.weatherRefreshSeconds else widget.refreshInterval

    var effectiveUrl by remember { mutableStateOf<String?>(null) }  // null = 定位解析中
    var showLocationHint by remember { mutableStateOf(false) }
    var locationStatus by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    // 解析最终请求 URL：前提是已授权定位。定位成功用经纬度替换 city/q，失败则城市兜底。可重复调用（手动重新定位）。
    suspend fun resolveLocation() {
        if (!hasCityQuery(jsonUrl)) {
            effectiveUrl = jsonUrl
            return
        }
        locationStatus = "📍 定位中…"
        val loc = LocationUtil.getLastLocation(appContext)
        if (loc != null) {
            effectiveUrl = LocationUtil.replaceCityWithCoordinates(jsonUrl, loc.first, loc.second)
            Log.d("WeatherJWT", "定位成功，URL=${LocationUtil.replaceCityWithCoordinates(jsonUrl, loc.first, loc.second)}")
            locationStatus = null
            return
        }
        Log.w("WeatherJWT", "已授权但定位获取失败，回退城市")
        val fallback = config.fallbackCity.trim()
        effectiveUrl = if (fallback.isNotEmpty()) {
            LocationUtil.replaceCityWithAnotherCity(jsonUrl, fallback)
        } else {
            jsonUrl
        }
        showLocationHint = true
        locationStatus = if (fallback.isNotEmpty()) {
            "⚠️ 定位失败，已使用 $fallback，点击重试"
        } else {
            "⚠️ 定位失败，已使用默认城市，点击重试"
        }
    }

    // 定位权限请求（用户授权后自动定位，拒绝后回退城市 + 提示）
    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            showLocationHint = false
            scope.launch { resolveLocation() }
        } else {
            Log.w("WeatherJWT", "用户拒绝定位权限，回退城市")
            val fallback = config.fallbackCity.trim()
            effectiveUrl = if (fallback.isNotEmpty()) {
                LocationUtil.replaceCityWithAnotherCity(jsonUrl, fallback)
            } else {
                jsonUrl
            }
            showLocationHint = true
            locationStatus = if (fallback.isNotEmpty()) {
                "未开启定位，使用 $fallback，点击重试"
            } else {
                "未开启定位，使用默认城市，点击重试"
            }
        }
    }

    // ① 首次解析 URL：已授权 → 直接定位；未授权 → 自动请求权限（系统弹窗）
    LaunchedEffect(Unit) {
        if (!hasCityQuery(jsonUrl)) {
            effectiveUrl = jsonUrl
            return@LaunchedEffect
        }
        if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        ) {
            resolveLocation()
        } else {
            Log.w("WeatherJWT", "未授予定位权限，自动请求")
            locationStatus = "📍 正在请求定位权限…"
            locationLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
    }

    // ② 加载 / 定时刷新（基于 effectiveUrl，定位授权后自动重新触发）
    LaunchedEffect(effectiveUrl, refreshSec) {
        val url = effectiveUrl ?: return@LaunchedEffect  // 定位解析中，等待

        // 缓存键含 widget.id：按主题/控件隔离，避免跨主题串数据（load() 内部引用，须提前声明）
        val cacheKey = "${widget.id}|$url"

        suspend fun load() {
            loading = true
            error = null
            try {
                // 无登录：不主动注入 Authorization（登录已移除），统一走 X-API-Key 鉴权。
                // 主题里的 Authorization: Bearer <token> 占位符剔除（与云端同一鉴权方案）。
                // 同时渲染 ${apiKey} 占位符（从全局配置读取）
                val globalApiKey = appContext
                    .getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
                    .getString("weather_api_key", "") ?: ""
                // 天气接口 URL 归一化：debug 保留局域网（本地联调），release 统一云端
                val normalized = WeatherWidget.normalizeLegacyUrl(url, config.fallbackCity)
                // 渲染 URL 中的 ${city} / ${apiKey} 占位符
                val resolvedUrl = normalized
                    .replace("\${city}", config.fallbackCity.ifBlank { "北京" })
                    .replace("\${apiKey}", globalApiKey)
                // 渲染 headers 中的 ${apiKey} / ${token} 占位符；剔除旧版 Bearer 鉴权头（占位符无意义）
                val headers = widget.headers
                    .filterKeys { !it.equals("Authorization", ignoreCase = true) }
                    .mapValues { (_, v) -> v.replace("\${apiKey}", globalApiKey) }
                    .toMutableMap()
                // 自动注入 X-API-Key：使用天气 API 且全局 Key 已配置但 headers 未设置时
                // （debug/release 同一鉴权方案，局域网与云端都走 X-API-Key）
                val isWeatherApi = resolvedUrl.isWeatherApiUrl()
                if (globalApiKey.isNotBlank() &&
                    !headers.containsKey("X-API-Key") &&
                    isWeatherApi
                ) {
                    headers["X-API-Key"] = globalApiKey
                }
                // 天气接口但未配置 Key：不发请求（避免 401），提示去设置页填写
                if (isWeatherApi && globalApiKey.isBlank() && !headers.containsKey("X-API-Key")) {
                    Log.w("WeatherJWT", "天气接口未配置 Key，跳过请求")
                    if (data != null) {
                        Toast.makeText(appContext, "未配置天气密钥，请在设置中填写", Toast.LENGTH_SHORT).show()
                    } else {
                        data = null
                        error = "未配置天气密钥，请在设置中填写天气 Key"
                    }
                    return
                }
                Log.d("WeatherJWT", "请求 $resolvedUrl  headers=$headers")
                val text = GenericHttpService.requestText(
                    resolvedUrl, "GET", headers, null,
                    allowHttpError = true
                )
                val parsed = parseJson(text)
                if (parsed is JSONObject) {
                    val code = parsed.optInt("code", 200)
                    if (code != 200) {
                        val errMsg = parsed.optString("message", "错误代码: $code")
                        if (data != null) {
                            // 配额用尽等业务错误：保留最后一次成功数据，仅 toast 提示，不清空
                            Log.w("WeatherJWT", "刷新失败，保留上次数据: $errMsg")
                            Toast.makeText(appContext, errMsg, Toast.LENGTH_SHORT).show()
                        } else {
                            // 首次加载即失败（无历史数据）→ 显示错误页
                            data = null
                            error = errMsg
                        }
                        return
                    }
                    val inner = parsed.optJSONObject("data")
                    data = inner ?: parsed
                } else {
                    data = parsed
                }
                JsonDataCache.put(cacheKey, data)
            } catch (e: kotlinx.coroutines.CancellationException) {
                // 组件退出 / 刷新键变化时协程被取消：必须重抛，避免被下方兜底 catch 吞掉，
                // 导致刷新计时循环（while(isActive)）无法干净退出
                throw e
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }

        val ttlMs = if (refreshSec > 0) refreshSec * 1000L else 3600_000L
        JsonDataCache.get(cacheKey, ttlMs)?.let { data = it }
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

    // 定位解析中 → 等待，不加载
    if (effectiveUrl == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("📍 定位中…", fontSize = 14.sp, color = Color.Gray)
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
            if (showLocationHint) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clickable { locationLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }
                        .padding(16.dp)
                ) {
                    Text("📍", fontSize = 20.sp)
                    Text("点击授权定位以获取本地天气", fontSize = 12.sp, color = Color(0xFF666666))
                }
            } else {
                Text("无数据", fontSize = 12.sp, color = Color.Gray)
            }
        }
        else -> Box(modifier = Modifier.fillMaxSize()) {
            JsonContent(data!!, widget)
            if (showLocationHint) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .clickable { locationLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }
                        .background(Color(0xBBFFFFFF), RoundedCornerShape(0.dp, 0.dp, 8.dp, 8.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text("📍 使用当前位置", fontSize = 11.sp, color = Color(0xFF2196F3))
                }
            }
            // 底部定位状态 / 重新定位条（可点击重新定位）
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(Color(0x66000000))
                    .clickable { scope.launch { resolveLocation() } }
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = locationStatus ?: "📍 重新定位",
                    fontSize = 11.sp,
                    color = Color.White
                )
            }
        }
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

// 天气数据可视化

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

/** wttr.in 使用的 Met Office 天气代码 → emoji（同包 WeatherWidgetRenderer 复用） */
internal val CODE_ICONS: Map<Int, String> = mapOf(
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

internal fun weatherIconFor(code: Int?, desc: String): String {
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

/** 从任意 JSON 提取天气代码：兼容 wttr.in 的字符串/数字（"113" 或 113）与部分接口的 [{ "value": "113" }] 结构 */
private fun weatherCodeOf(holder: Any?): Int? = when (holder) {
    is JSONArray -> holder.optJSONObject(0)?.optString("value")?.toIntOrNull()
    is Int -> holder
    is Long -> holder.toInt()
    is Number -> holder.toInt()
    is String -> holder.toIntOrNull()
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
                // 取中午的天气代码作代表：wttr.in j1 的 hourly 每 3 小时 1 点共 8 点
                // （0=00:00 … 4=12:00 … 6=18:00），原 index 6 实为傍晚，导致与
                // hourly[0]（00:00）等取值得到的图标不一致
                val noon = hourly?.takeIf { it.length() > 4 }?.optJSONObject(4)
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
