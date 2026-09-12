package com.ailinkcat.mobile.utils

/**
 * Native 签名校验器，核心逻辑在 libnative-signature.so：
 * SHA-256 自包含实现；期望哈希存于 .so 的 .rodata 段（反编译 DEX 不可见）；反调试（TracerPid）；常量时间比较。
 * 注意：此类必须 keep（JNI 方法名绑定），已在 proguard-rules.pro 配置。
 */
object NativeSignatureChecker {

    init {
        System.loadLibrary("native-signature")
    }

    /**
     * Native 签名校验。
     * @param signature 签名证书原始字节（Signature.toByteArray()），由 Kotlin 侧传入，native 只负责计算比较。
     * @return true=匹配，false=不匹配或校验失败
     */
    external fun verify(signature: ByteArray?): Boolean
}