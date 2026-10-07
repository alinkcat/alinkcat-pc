package com.ailinkcat.mobile.utils

/** signature verification in libnative-signature.so: self-contained sha-256, expected hash
 *  hidden in the .so's .rodata (invisible from dex), TracerPid anti-debug, constant-time compare.
 *  this class must be kept for JNI name binding, see proguard-rules.pro */
object NativeSignatureChecker {

    init {
        System.loadLibrary("native-signature")
    }

    /** [signature] = raw cert bytes (Signature.toByteArray()); native only computes and compares */
    external fun verify(signature: ByteArray?): Boolean
}