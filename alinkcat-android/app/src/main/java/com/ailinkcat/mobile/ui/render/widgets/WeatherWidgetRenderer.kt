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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.domain.models.WeatherWidget
import com.ailinkcat.mobile.service.GenericWeatherService
import com.ailinkcat.mobile.service.GenericWeatherService.WeatherInfo
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/**
 * Weather widget: reads the same config fields as the PC editor and delegates
 * fetching to GenericWeatherService, refreshing every refreshHours.
 */
@Composable
fun WeatherWidgetRenderer(widget: WeatherWidget) {
    var info by remember { mutableStateOf<WeatherInfo?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    // global API key (settings page) as fallback when the theme has none;
    // read reactively from SharedPreferences so key changes apply immediately
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

    // same configured rules as the PC: default URLs need both city and key,
    // custom URLs accept either. Match by path because normalizeLegacyUrl
    // already substituted ${city}, so exact literals never hit
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
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🌤️", fontSize = 28.sp)
                Text(stringResource(R.string.weather_key_not_configured), fontSize = 13.sp, color = Color.Gray)
                Text(
                    text = stringResource(R.string.weather_key_not_configured_hint),
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

/** maps the PC's nested responseMapping (field -> JSON path) to the service layer's shape */
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
