package com.ailinkcat.mobile.utils

/**
 * Native 签名校验器。
 *
 * 核心逻辑在 libnative-signature.so 中：
 * - SHA-256 哈希计算（自包含实现，无外部依赖）
 * - 期望哈希值存储在 .so 的 .rodata 段，反编译 DEX 不可见
 * - 反调试检测（TracerPid）
 * - 常量时间比较（防时序攻击）
 *
 * 注意：此类必须被 keep（JNI 方法名绑定），已在 proguard-rules.pro 中配置。
 */
object NativeSignatureChecker {

    init {
        System.loadLibrary("native-signature")
    }

    /**
     * Native 签名校验。
     *
     * @param signature 签名证书的原始字节数组（Signature.toByteArray()），
     *                  由 Kotlin 侧获取后传入，native 只负责计算和比较。
     * @return true = 签名匹配，false = 不匹配或校验失败
     */
    external fun verify(signature: ByteArray?): Boolean
}