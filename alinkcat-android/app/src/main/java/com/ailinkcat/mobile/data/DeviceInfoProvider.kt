package com.ailinkcat.mobile.data

import android.content.Context
import android.os.Build
import android.provider.Settings

/** collects device identity for the login request: android id, model, os/app version */
class DeviceInfoProvider(private val context: Context) {

    /** android id: unique per app+device on 10+, stable until factory reset */
    fun getDeviceCode(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    fun getDeviceName(): String {
        return "${Build.MANUFACTURER} ${Build.MODEL}".takeIf { it.isNotBlank() }
            ?: Build.MODEL
    }

    fun getDeviceType(): String = "android"

    fun getOsVersion(): String = Build.VERSION.RELEASE ?: "Unknown"

    fun getAppVersion(): String = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
    } catch (_: Exception) {
        "1.0.0"
    }

    fun collect(): DeviceInfo = DeviceInfo(
        deviceCode = getDeviceCode(),
        deviceName = getDeviceName(),
        deviceType = getDeviceType(),
        osVersion = getOsVersion(),
        appVersion = getAppVersion()
    )
}

data class DeviceInfo(
    val deviceCode: String,
    val deviceName: String,
    val deviceType: String,
    val osVersion: String,
    val appVersion: String
)