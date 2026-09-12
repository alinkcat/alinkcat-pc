package com.ailinkcat.mobile.utils

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/**
 * 签名校验门面：Java 层极简壳，无日志输出。
 * 校验逻辑与期望 MD5 均在 libnative-signature.so（C++）中，Java 层只取签名证书字节并调用 native。
 */
object SignatureVerifier {

    @Volatile
    private var verified: Boolean? = null

    /** 校验签名与 Native 层期望一致，结果只计算一次并缓存。 */
    fun verify(context: Context): Boolean {
        verified?.let { return it }

        val raw = getRawSignature(context)
        // 不打印证书指纹，防止泄露
        val result = raw != null && NativeSignatureChecker.verify(raw)
        verified = result
        return result
    }

    /** 重置缓存（仅测试用）。 */
    fun reset() {
        verified = null
    }

    private fun getRawSignature(ctx: Context): ByteArray? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // API 28+ 用 GET_SIGNING_CERTIFICATES（GET_SIGNATURES 已废弃）
                val info = ctx.packageManager.getPackageInfo(
                    ctx.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                info.signingInfo?.apkContentsSigners?.firstOrNull()?.toByteArray()
            } else {
                @Suppress("DEPRECATION")
                val info = ctx.packageManager.getPackageInfo(
                    ctx.packageName,
                    PackageManager.GET_SIGNATURES
                )
                info.signatures?.firstOrNull()?.toByteArray()
            }
        } catch (_: Exception) {
            null
        }
    }
}