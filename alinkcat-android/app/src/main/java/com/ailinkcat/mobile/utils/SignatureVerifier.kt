package com.ailinkcat.mobile.utils

import android.content.Context
import android.content.pm.PackageManager

/**
 * 签名校验门面（Java 层极简壳，无任何日志输出）。
 *
 * 安全设计：
 * - 校验逻辑与期望 MD5 全部在 libnative-signature.so 中（C++ 机器码）
 * - Java 层只负责获取签名证书原始字节并调用 native 方法
 * - 反调试检测、哈希比较均在 native 层完成
 */
object SignatureVerifier {

    @Volatile
    private var verified: Boolean? = null

    /**
     * 校验签名是否与 Native 层期望一致。
     * 结果只计算一次并被缓存。
     */
    fun verify(context: Context): Boolean {
        verified?.let { return it }

        val raw = getRawSignature(context)
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
            val info = ctx.packageManager.getPackageInfo(
                ctx.packageName,
                PackageManager.GET_SIGNATURES
            )
            info.signatures?.firstOrNull()?.toByteArray()
        } catch (_: Exception) {
            null
        }
    }
}