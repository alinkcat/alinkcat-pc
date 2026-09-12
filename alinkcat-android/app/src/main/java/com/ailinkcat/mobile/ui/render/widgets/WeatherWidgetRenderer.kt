package com.ailinkcat.mobile.ui.render.widgets

import android.content.Context
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.domain.models.WeatherWidget
import com.ailinkcat.mobile.service.GenericWeatherService
import com.ailinkcat.mobile.service.GenericWeatherService.WeatherInfo
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/**
 * 天气控件：根据 widget 配置读取天气数据并展示。
 * 读取与 PC 端一致的字段（requestUrl / requestMethod / requestHeaders / requestBody /
 * city / apiKey / extraParams / unit / refreshHours / responseMapping 嵌套对象），
 * 数据获取交给 GenericWeatherService，支持按小时自动刷新。
 */
@Composable
fun WeatherWidgetRenderer(widget: WeatherWidget) {
    var info by remember { mutableStateOf<WeatherInfo?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    // 全局天气 API Key（设置页可配置）：主题未配置 Key 时兜底。
    // 响应式读取：监听 SharedPreferences 变化写入 StateFlow 并 collect，
    // 设置页修改 Key 后本控件立即生效，而非一次性读取（旧实现改 Key 后需等重组才生效）。
    val context = LocalContext.current
    val appContext = context.applicationContext
    val apiKeyFlow = remember(appContext) {
        MutableStateFlow(
            appContext.getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
                .getString("weather_api_key", "") ?: ""
        )
    }
    DisposableEffect(appContext) {
        val prefs = appContext.getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
        val listener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == "weather_api_key") {
                apiKeyFlow.value = prefs.getString("weather_api_key", "") ?: ""
            }
        }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        onDispose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }
    val globalApiKey by apiKeyFlow.collectAsState()
    // 主题配置的 Key 优先，其次全局 Key
    val effectiveApiKey = widget.apiKey.ifBlank { globalApiKey }
    val effectiveCity = widget.city

    val config = remember(widget, effectiveApiKey) {
        GenericWeatherService.WeatherWidgetConfig(
            requestUrl = widget.requestUrl,
            requestMethod = widget.requestMethod,
            requestHeaders = widget.requestHeaders,
            requestBody = widget.requestBody,
            city = effectiveCity,
            apiKey = effectiveApiKey,
            extraParams = widget.extraParams,
            responseMapping = mapToResponseMapping(widget.responseMapping),
            refreshHours = widget.refreshHours
        )
    }

    LaunchedEffect(config) {
        suspend fun load() {
            loading = true
            error = null
            try {
                info = GenericWeatherService.fetchWeather(config)
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
        load()
        if (config.refreshHours > 0) {
            while (isActive) {
                delay((config.refreshHours * 3600_000).toLong())
                load()
            }
        }
    }

    // 已配置判断（与 PC 端一致）：
    // - 使用默认 URL（自建天气 API 或旧版 OWM 直连）时，必须同时提供城市与 API Key
    // - 自定义 URL 时，提供城市或 Key 之一即可（其余参数可作为占位符）
    // 路径匹配而非精确相等：normalizeLegacyUrl 已把 ${city} 替换为实际城市，字面常量无法命中
    val isDefault = widget.requestUrl.isBlank() ||
        widget.requestUrl.contains("api/public/weather") ||
        widget.requestUrl.contains("api/weather/") ||
        widget.requestUrl.contains("api.openweathermap.org")
    val configured = if (isDefault) {
        effectiveCity.isNotBlank() && effectiveApiKey.isNotBlank()
    } else {
        effectiveCity.isNotBlank() || effectiveApiKey.isNotBlank()
    }
    if (!configured) {
        // 未配置天气密钥：不渲染天气，直接显示配置提示
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🌤️", fontSize = 28.sp)
                Text("未配置天气密钥", fontSize = 13.sp, color = Color.Gray)
                Text(
                    text = "在设置中填写天气 API Key 后使用",
                    fontSize = 11.sp,
                    color = Color.Gray.copy(alpha = 0.7f)
                )
            }
        }
        return
    }

    if (loading && info == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("⏳", fontSize = 24.sp)
        }
        return
    }

    if (error != null && info == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("❌ $error", fontSize = 12.sp, color = Color(0xFFFF6B6B))
        }
        return
    }

    val data = info ?: return
    val degree = if (widget.unit == "f") "°F" else "°C"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "${data.city} ${weatherIconFor(data.icon.toIntOrNull(), data.description)}",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "${data.temp.roundToInt()}$degree",
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold
        )
        Text(text = data.description, fontSize = 14.sp, color = Color.Gray)
        Text(
            text = "💧 ${data.humidity}%   🌬️ ${data.wind_speed.roundToInt()}   🌡️ ${data.feels_like.roundToInt()}$degree",
            fontSize = 13.sp
        )
        if (data.forecast.isNotEmpty()) {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                data.forecast.forEach { day ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(day.date.takeLast(5), fontSize = 12.sp, color = Color.Gray)
                        Text(weatherIconFor(day.icon.toIntOrNull(), day.condition), fontSize = 18.sp)
                        Text(
                            text = "${day.temp_max.roundToInt()}° / ${day.temp_min.roundToInt()}°",
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

/** 把 PC 端嵌套 responseMapping 对象（目标字段 → JSON 路径）转换为服务层所需的映射结构 */
private fun mapToResponseMapping(map: Map<String, String>): GenericWeatherService.ResponseMapping =
    GenericWeatherService.ResponseMapping(
        city = map["city"],
        temp = map["temp"],
        condition = map["condition"],
        description = map["description"],
        icon = map["icon"],
        humidity = map["humidity"],
        wind_speed = map["wind_speed"],
        feels_like = map["feels_like"],
        forecastPath = map["forecast"]
    )
