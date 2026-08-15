package com.ailinkcat.mobile.data

import android.content.Context
import android.os.Build
import android.provider.Settings

/**
 * 设备信息提供器：收集登录接口所需的设备标识与环境信息。
 *
 * - deviceCode：使用 Android ID（Settings.Secure.ANDROID_ID）
 *   Android 10+ 中，Android ID 按应用签名密钥+设备唯一，不受权限限制，
 *   且出厂重置后才会变化，是不可伪造的稳定标识。
 * - deviceName：Build.MODEL
 * - deviceType：固定 "android"
 * - osVersion：Build.VERSION.RELEASE（如 "14"）
 * - appVersion：BuildConfig.VERSION_NAME
 */
class DeviceInfoProvider(private val context: Context) {

    /** 设备唯一标识：Android ID（64位十六进制，出厂重置前不变）。 */
    fun getDeviceCode(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    /** 设备型号名称，如 "Xiaomi 14"、"SM-S9280"。 */
    fun getDeviceName(): String {
        return "${Build.MANUFACTURER} ${Build.MODEL}".takeIf { it.isNotBlank() }
            ?: Build.MODEL
    }

    /** 设备类型，固定返回 "android"。 */
    fun getDeviceType(): String = "android"

    /** 系统版本号，如 "14"、"13"。 */
    fun getOsVersion(): String = Build.VERSION.RELEASE ?: "Unknown"

    /** 应用版本号，来自 BuildConfig。 */
    fun getAppVersion(): String = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
    } catch (_: Exception) {
        "1.0.0"
    }

    /** 一次性返回所有设备信息字段。 */
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