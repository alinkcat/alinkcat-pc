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
import androidx.compose.ui.res.stringResource
import android.content.Context
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.BuildConfig
import com.ailinkcat.mobile.R
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
 * WebView widget. Default mode loads a URL; displayMode=json fetches jsonUrl
 * and renders it (weather structures get a dashboard, anything else a generic
 * list), matching the PC's WebViewJSON behavior.
 */
@Composable
fun WebViewWidgetRenderer(widget: WebViewWidget) {
    if (widget.displayMode.equals("json", ignoreCase = true)) {
        JsonDataRenderer(widget)
        return
    }
    if (widget.displayMode.equals("rss", ignoreCase = true)) {
        RssDataRenderer(widget)
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

    // URLs from theme packs aren't trusted; http/https only
    val uri = try {
        android.net.Uri.parse(url)
    } catch (_: Exception) {
        null
    }
    val scheme = uri?.scheme?.lowercase()
    if (scheme != "http" && scheme != "https") {
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
        // detach children before destroy, or the WebView leaks
        onRelease = { webView ->
            webView.removeAllViews()
            webView.destroy()
        }
    )
}

/**
 * Cache so page switches don't refetch; entries expire past the refresh TTL.
 * Bounded to MAX_ENTRIES (oldest evicted first) and keyed per widget.id so
 * themes can't cross-contaminate each other's data.
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
        while (cache.size > MAX_ENTRIES) {
            val oldest = cache.keys.firstOrNull() ?: break
            cache.remove(oldest)
        }
    }
}

/**
 * Theme packs often hardcode a dev LAN address (http://192.168.6.144:8080)
 * in jsonUrl. Debug keeps it for local backend work; release rewrites the LAN
 * IP to the single AuthApi.BASE_URL host. Weather URLs are excluded —
 * WeatherWidget.normalizeLegacyUrl owns that rewrite, and running both would
 * double-apply.
 */
private fun resolveThemeJsonUrl(raw: String): String {
    if (BuildConfig.DEBUG) return raw
    return raw.replace(
        Regex("""^http://\d{1,3}(\.\d{1,3}){3}(:\d+)?"""),
        AuthApi.BASE_URL
    )
}

/** self-hosted weather API check; must match WeatherWidget.normalizeLegacyUrl's rule */
private fun String.isWeatherApiUrl(): Boolean =
    contains("api/public/weather") || contains("api/weather/mobile") || contains("api/weather/")

/**
 * Matches city-ish query params (city / q / cityName / city_name), values may
 * be percent-encoded. Replaces a naive "city="/"q=" contains check that
 * missed the aliases and could match path segments by accident.
 */
private val CITY_QUERY_PARAM =
    Regex("""[?&](?:city|q|cityname|city_name)(?:=|%3D)[^&#]*""", RegexOption.IGNORE_CASE)

private fun hasCityQuery(url: String): Boolean = CITY_QUERY_PARAM.containsMatchIn(url)

@Composable
private fun JsonDataRenderer(widget: WebViewWidget) {
    // one host rewrite only: weather URLs go through normalizeLegacyUrl, other
    // JSON APIs get resolveThemeJsonUrl's BASE_URL rewrite in release
    val rawJsonUrl = widget.jsonUrl
    val jsonUrl = if (rawJsonUrl.isWeatherApiUrl()) rawJsonUrl else resolveThemeJsonUrl(rawJsonUrl)
    val jsonUrlValid = jsonUrl.startsWith("http://", ignoreCase = true) ||
        jsonUrl.startsWith("https://", ignoreCase = true)
    var data by remember { mutableStateOf<Any?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val appContext = LocalContext.current.applicationContext
    val dataStore = remember { DataStoreManager(appContext) }
    val config by dataStore.config.collectAsStateWithLifecycle(initialValue = StoredConfig())
    // user's refresh interval (seconds); overrides the theme's refreshInterval when > 0
    val refreshSec = if (config.weatherRefreshSeconds > 0) config.weatherRefreshSeconds else widget.refreshInterval

    var effectiveUrl by remember { mutableStateOf<String?>(null) }  // null = still resolving location
    var showLocationHint by remember { mutableStateOf(false) }
    var locationStatus by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val langManager = remember { com.ailinkcat.mobile.i18n.LanguageManager.get(appContext) }

    // resolve the final request URL: swap city/q for coordinates when location
    // works, fall back to the configured city otherwise; safe to call again
    // (manual re-locate)
    suspend fun resolveLocation() {
        if (!hasCityQuery(jsonUrl)) {
            effectiveUrl = jsonUrl
            return
        }
        locationStatus = langManager.getString(R.string.locating)
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
            langManager.getString(R.string.location_failed_with_city, fallback)
        } else {
            langManager.getString(R.string.location_failed_default_city)
        }
    }

    // location permission: grant -> locate right away, deny -> fall back to city
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
                langManager.getString(R.string.location_off_with_city, fallback)
            } else {
                langManager.getString(R.string.location_off_default_city)
            }
        }
    }

    // first pass: locate directly if already granted, otherwise auto-request permission
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
            locationStatus = langManager.getString(R.string.requesting_location_permission)
            locationLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
    }

    // load + periodic refresh, keyed on effectiveUrl so granting location re-triggers it
    LaunchedEffect(effectiveUrl, refreshSec) {
        val url = effectiveUrl ?: return@LaunchedEffect  // still resolving, wait
        if (!jsonUrlValid) {
            error = langManager.getString(R.string.unsupported_link, url)
            return@LaunchedEffect
        }

        // cache key includes widget.id so themes don't share data
        val cacheKey = "${widget.id}|$url"

        suspend fun load() {
            loading = true
            error = null
            try {
                // no login anymore: auth goes through X-API-Key, drop the legacy
                // Authorization: Bearer placeholders; also render ${apiKey}
                val globalApiKey = appContext
                    .getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
                    .getString("weather_api_key", "") ?: ""
                // normalize weather URLs: debug keeps LAN for local testing, release points at cloud
                val normalized = WeatherWidget.normalizeLegacyUrl(url, config.fallbackCity)
                val resolvedUrl = normalized
                    .replace("\${city}", config.fallbackCity.ifBlank { langManager.getString(R.string.weather_default_city_fallback) })
                    .replace("\${apiKey}", globalApiKey)
                // strip the legacy Bearer header, render ${apiKey} in the rest
                val headers = widget.headers
                    .filterKeys { !it.equals("Authorization", ignoreCase = true) }
                    .mapValues { (_, v) -> v.replace("\${apiKey}", globalApiKey) }
                    .toMutableMap()
                // auto-inject X-API-Key for the weather API when the global key
                // is set and headers don't carry it
                val isWeatherApi = resolvedUrl.isWeatherApiUrl()
                if (globalApiKey.isNotBlank() &&
                    !headers.containsKey("X-API-Key") &&
                    isWeatherApi
                ) {
                    headers["X-API-Key"] = globalApiKey
                }
                // weather API without a key: skip the request (avoids 401) and point at settings
                if (isWeatherApi && globalApiKey.isBlank() && !headers.containsKey("X-API-Key")) {
                    Log.w("WeatherJWT", "天气接口未配置 Key，跳过请求")
                    if (data != null) {
                        Toast.makeText(appContext, langManager.getString(R.string.weather_key_missing_toast), Toast.LENGTH_SHORT).show()
                    } else {
                        data = null
                        error = langManager.getString(R.string.weather_key_missing_error)
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
                        val errMsg = parsed.optString("message", langManager.getString(R.string.error_code_fmt, code))
                    if (data != null) {
                        // business errors (quota etc.): keep the last good data, just toast
                        Log.w("WeatherJWT", "刷新失败，保留上次数据: $errMsg")
                        Toast.makeText(appContext, errMsg, Toast.LENGTH_SHORT).show()
                    } else {
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
                // must rethrow: swallowing cancellation here would break the
                // refresh loop's clean exit
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
                Text(stringResource(R.string.configure_json_url), fontSize = 12.sp, color = Color.Gray)
            }
        }
        return
    }

    if (effectiveUrl == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.locating), fontSize = 14.sp, color = Color.Gray)
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
                    Text(stringResource(R.string.tap_to_authorize_location), fontSize = 12.sp, color = Color(0xFF666666))
                }
            } else {
                Text(stringResource(R.string.no_data), fontSize = 12.sp, color = Color.Gray)
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
                    Text(stringResource(R.string.use_current_location), fontSize = 11.sp, color = Color(0xFF2196F3))
                }
            }
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
                    text = locationStatus ?: stringResource(R.string.relocate),
                    fontSize = 11.sp,
                    color = Color.White
                )
            }
        }
    }
}

/** displayMode=rss: fetch rssUrl, parse items, reuse the generic list renderer */
@Composable
private fun RssDataRenderer(widget: WebViewWidget) {
    val rawUrl = widget.rssUrl
    val appContext = LocalContext.current.applicationContext
    if (rawUrl.isBlank()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("📰", fontSize = 28.sp, color = Color.Gray)
                Text(stringResource(R.string.rss_configure_hint), fontSize = 12.sp, color = Color.Gray)
            }
        }
        return
    }

    var data by remember(widget.id) { mutableStateOf<Any?>(null) }
    var error by remember(widget.id) { mutableStateOf<String?>(null) }
    var loading by remember(widget.id) { mutableStateOf(false) }

    suspend fun load() {
        loading = true
        error = null
        try {
            // theme pack URLs are third-party input: http/https only
            val valid = rawUrl.startsWith("http://", ignoreCase = true) ||
                rawUrl.startsWith("https://", ignoreCase = true)
            if (!valid) {
                error = appContext.getString(R.string.unsupported_link, rawUrl)
                return
            }
            val headers = widget.headers
                .filterKeys { !it.equals("Authorization", ignoreCase = true) }
            val text = GenericHttpService.requestText(rawUrl, "GET", headers, null, allowHttpError = true)
            val items = com.ailinkcat.mobile.util.RssParser.parse(text)
            if (items.length() == 0) {
                error = appContext.getString(R.string.rss_parse_failed)
                return
            }
            data = items
            JsonDataCache.put("${widget.id}|rss|$rawUrl", data)
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            error = e.message
        } finally {
            loading = false
        }
    }

    LaunchedEffect(widget.id, rawUrl) {
        val ttl = if (widget.refreshInterval > 0) widget.refreshInterval * 1000L else 600_000L
        JsonDataCache.get("${widget.id}|rss|$rawUrl", ttl)?.let { data = it }
        if (data == null) load()
        if (widget.refreshInterval > 0) {
            while (isActive) {
                kotlinx.coroutines.delay(widget.refreshInterval * 1000L)
                load()
            }
        }
    }

    when {
        loading && data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("⏳", fontSize = 24.sp)
        }
        error != null && data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("❌ $error", fontSize = 11.sp, color = Color(0xFFFF6B6B))
        }
        data == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.no_data), fontSize = 12.sp, color = Color.Gray)
        }
        else -> Box(modifier = Modifier.fillMaxSize()) {
            JsonContent(data!!, widget)
        }
    }
}

@Composable
private fun JsonContent(data: Any, widget: WebViewWidget) {
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
                    EmptyText(stringResource(R.string.no_data))
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
                    EmptyText(stringResource(R.string.no_data))
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
    val title = JsonPath.get(item, widget.titleField)?.toString() ?: stringResource(R.string.json_item_default_title)
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

/** Met Office weather codes (as used by wttr.in) to emoji */
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

/** weather code from whatever JSON shape shows up: "113", 113, or [{ "value": "113" }] */
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

/** extract weather data from arbitrary JSON; null if it's not a weather shape (mirrors the PC's weatherJson.ts) */
private fun extractWeather(data: Any?): WeatherData? {
    if (data !is JSONObject) return null

    // wttr.in j1 format
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
                // use the noon entry as the day's icon; hourly is every 3h
                // (4 = 12:00) and the previously used index 6 was evening,
                // which disagreed with the current-conditions icon
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

    // OpenWeatherMap format
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = w.city ?: stringResource(R.string.weather_default_title),
                color = Color(0xFF1A1A2E),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.width(6.dp))
            Text(text = w.icon, fontSize = 30.sp)
        }

        Text(
            text = if (w.temp != null) "${w.temp.roundToInt()}°C" else "--",
            color = Color(0xFF1A1A2E),
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Text(
            text = w.desc,
            color = Color(0xFF666666),
            fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

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
