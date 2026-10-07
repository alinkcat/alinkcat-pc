package com.ailinkcat.mobile.utils

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/** minimal java-side shell, no logging; the real check and expected hash live in
 *  libnative-signature.so, java just passes the cert bytes over */
object SignatureVerifier {

    @Volatile
    private var verified: Boolean? = null

    /** computes once and caches */
    fun verify(context: Context): Boolean {
        verified?.let { return it }

        val raw = getRawSignature(context)
        // never log the cert fingerprint
        val result = raw != null && NativeSignatureChecker.verify(raw)
        verified = result
        return result
    }

    /** test-only */
    fun reset() {
        verified = null
    }

    private fun getRawSignature(ctx: Context): ByteArray? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // GET_SIGNATURES is deprecated on 28+
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