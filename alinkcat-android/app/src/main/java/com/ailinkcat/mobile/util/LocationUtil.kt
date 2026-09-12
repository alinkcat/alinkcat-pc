package com.ailinkcat.mobile.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

/** 设备定位：天气组件按当前位置查询（零三方依赖，系统 LocationManager）。 */
object LocationUtil {

    private const val TAG = "WeatherLoc"

    /**
     * 获取当前经纬度（城市级天气足够）。
     * ① 优先最后已知位置；② 取不到时主动请求一次（网络优先，GPS 兜底，10 秒超时）。
     * 未授权/不可用返回 null，由调用方回退主题配置城市。
     * @return (纬度 latitude, 经度 longitude)
     */
    suspend fun getLastLocation(context: Context): Pair<Double, Double>? {
        return withContext(Dispatchers.IO) {
            try {
                if (ContextCompat.checkSelfPermission(
                        context, Manifest.permission.ACCESS_COARSE_LOCATION
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    Log.w(TAG, "未授予定位权限")
                    return@withContext null
                }
                val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                    ?: run { Log.w(TAG, "无 LocationManager"); return@withContext null }

                // ① 最后已知位置（快速）
                val last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                    ?: lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                if (last != null) {
                    Log.d(TAG, "最后已知位置: ${last.latitude},${last.longitude}")
                    return@withContext last.latitude to last.longitude
                }

                // ② 主动请求一次定位（网络优先，10 秒超时）
                Log.d(TAG, "无最后已知位置，主动请求定位…")
                val active = withTimeoutOrNull(10_000) {
                    requestSingleFix(lm)
                }
                if (active != null) {
                    Log.d(TAG, "主动定位成功: ${active.latitude},${active.longitude}")
                    return@withContext active.latitude to active.longitude
                }
                Log.w(TAG, "主动定位超时或失败")
                null
            } catch (e: Exception) {
                Log.w(TAG, "定位异常: ${e.message}")
                null
            }
        }
    }

    /** 主动请求一次定位（网络定位优先，失败则 GPS），超时由外层 withTimeoutOrNull 控制。 */
    private suspend fun requestSingleFix(lm: LocationManager): Location? {
        return suspendCancellableCoroutine { cont ->
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (cont.isActive) cont.resume(location)
                }
                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }
            val started = try {
                lm.requestSingleUpdate(LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper())
                true
            } catch (_: Exception) {
                try {
                    lm.requestSingleUpdate(LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper())
                    true
                } catch (_: Exception) {
                    false
                }
            }
            if (!started) cont.cancel()
            else cont.invokeOnCancellation { lm.removeUpdates(listener) }
        }
    }

    /**
     * 把 URL 中的 city / q 参数替换为经纬度（g=<lng>,<lat>，符合后端规范）。
     * 例：?city=北京 → ?g=116.4074,39.9042；都不含时原样返回。
     */
    fun replaceCityWithCoordinates(url: String, lat: Double, lng: Double): String {
        if (!url.contains("city=") && !url.contains("q=")) return url
        val coord = String.format(Locale.US, "g=%.4f,%.4f", lng, lat)
        // 先替换 city=（旧版接口）
        val afterCity = url.replace(Regex("([?&])city=[^&]*")) { m ->
            m.groupValues[1] + coord
        }
        // 再替换 q=（新版接口）
        return afterCity.replace(Regex("([?&])q=[^&]*")) { m ->
            m.groupValues[1] + coord
        }
    }

    /**
     * 把 URL 中的 city / q 参数替换为另一城市名（定位失败兜底）。
     * 例：?city=北京 → ?city=上海；都不含时原样返回。
     */
    fun replaceCityWithAnotherCity(url: String, city: String): String {
        if (!url.contains("city=") && !url.contains("q=")) return url
        val enc = java.net.URLEncoder.encode(city, "UTF-8")
        val afterCity = url.replace(Regex("([?&])city=[^&]*")) { m ->
            m.groupValues[1] + "city=$enc"
        }
        return afterCity.replace(Regex("([?&])q=[^&]*")) { m ->
            m.groupValues[1] + "q=$enc"
        }
    }
}
