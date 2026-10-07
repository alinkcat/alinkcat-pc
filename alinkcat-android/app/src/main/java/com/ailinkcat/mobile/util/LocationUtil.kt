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

/** device location for weather lookups, plain LocationManager, no third-party deps */
object LocationUtil {

    private const val TAG = "WeatherLoc"

    /** returns (lat, lng), city-level accuracy is plenty. last known location first, then a
     *  single active fix (network preferred, 10s timeout); null when unauthorized/unavailable,
     *  caller falls back to the theme's configured city */
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

                val last = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                    ?: lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                if (last != null) {
                    Log.d(TAG, "最后已知位置: ${last.latitude},${last.longitude}")
                    return@withContext last.latitude to last.longitude
                }

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

    /** single active fix, network first then GPS; timeout handled by the caller */
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

    /** replaces city/q params with g=<lng>,<lat>; url returned as-is when neither is present */
    fun replaceCityWithCoordinates(url: String, lat: Double, lng: Double): String {
        if (!url.contains("city=") && !url.contains("q=")) return url
        val coord = String.format(Locale.US, "g=%.4f,%.4f", lng, lat)
        // city= first (legacy endpoint)
        val afterCity = url.replace(Regex("([?&])city=[^&]*")) { m ->
            m.groupValues[1] + coord
        }
        // then q= (new endpoint)
        return afterCity.replace(Regex("([?&])q=[^&]*")) { m ->
            m.groupValues[1] + coord
        }
    }

    /** swaps city/q params for a fallback city name when location fails */
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
