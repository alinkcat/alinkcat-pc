#include <jni.h>
#include <string>
#include <cstring>
#include <fstream>

// ═══════════════════════════════════════════════════════════
// 期望签名证书的 MD5 摘要（16 字节）
// 对应 MD5: D0:63:CC:89:68:9E:92:43:47:A9:9C:B5:C1:7D:06:37
// 存储在 .rodata 段，无导出符号；反编译 DEX 不可见
// ═══════════════════════════════════════════════════════════
static const uint8_t EXPECTED[16] = {
    0xD0u, 0x63u, 0xCCu, 0x89u,
    0x68u, 0x9Eu, 0x92u, 0x43u,
    0x47u, 0xA9u, 0x9Cu, 0xB5u,
    0xC1u, 0x7Du, 0x06u, 0x37u
};

// ═══════════════════════════════════════════════════════════
// 反调试检测：读取 /proc/self/status 中的 TracerPid
// ═══════════════════════════════════════════════════════════

static bool is_traced() {
    std::ifstream status("/proc/self/status");
    std::string line;
    while (std::getline(status, line)) {
        if (line.compare(0, 9, "TracerPid") == 0) {
            std::string pid_str = line.substr(10);
            int pid = std::stoi(pid_str);
            return pid != 0;
        }
    }
    return false;
}

// ═══════════════════════════════════════════════════════════
// 常量时间比较（防时序攻击）
// ═══════════════════════════════════════════════════════════

static bool constant_time_compare(const uint8_t *a, const uint8_t *b, size_t len) {
    uint8_t diff = 0;
    for (size_t i = 0; i < len; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff == 0;
}

// ═══════════════════════════════════════════════════════════
// JNI 接口
// 通过 JNI 调用系统 MessageDigest 计算 MD5（数学计算本身不敏感），
// 期望值与比较逻辑留在 native 层，攻击者无法通过 patch Java 绕过。
// ═══════════════════════════════════════════════════════════

extern "C" JNIEXPORT jboolean JNICALL
Java_com_ailinkcat_mobile_utils_NativeSignatureChecker_verify(
    JNIEnv *env, jobject thiz, jbyteArray signature) {

    // 1. 反调试：检测到被跟踪时静默拒绝
    if (is_traced()) {
        return JNI_FALSE;
    }

    // 2. 输入校验（静默失败）
    if (signature == nullptr) {
        return JNI_FALSE;
    }
    jsize len = env->GetArrayLength(signature);
    if (len <= 0) {
        return JNI_FALSE;
    }

    // 3. 通过 JNI 调用 MessageDigest.getInstance("MD5").digest(signature)
    jclass mdClass = env->FindClass("java/security/MessageDigest");
    if (mdClass == nullptr) {
        return JNI_FALSE;
    }
    jmethodID getInstance = env->GetStaticMethodID(
        mdClass, "getInstance", "(Ljava/lang/String;)Ljava/security/MessageDigest;");
    if (getInstance == nullptr) {
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }
    jstring md5Name = env->NewStringUTF("MD5");
    jobject md = env->CallStaticObjectMethod(mdClass, getInstance, md5Name);
    env->DeleteLocalRef(md5Name);
    if (md == nullptr) {
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }
    jmethodID digestMethod = env->GetMethodID(mdClass, "digest", "([B)[B");
    if (digestMethod == nullptr) {
        env->DeleteLocalRef(md);
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }
    jbyteArray digestBytes = (jbyteArray)env->CallObjectMethod(md, digestMethod, signature);
    if (digestBytes == nullptr) {
        env->DeleteLocalRef(md);
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }
    jsize digestLen = env->GetArrayLength(digestBytes);
    if (digestLen != 16) {
        env->DeleteLocalRef(digestBytes);
        env->DeleteLocalRef(md);
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }
    jbyte *digest = env->GetByteArrayElements(digestBytes, nullptr);
    if (digest == nullptr) {
        env->DeleteLocalRef(digestBytes);
        env->DeleteLocalRef(md);
        env->DeleteLocalRef(mdClass);
        return JNI_FALSE;
    }

    // 4. 与期望的 16 字节 MD5 常量时间比较
    bool match = constant_time_compare(
        reinterpret_cast<const uint8_t *>(digest), EXPECTED, 16);

    env->ReleaseByteArrayElements(digestBytes, digest, JNI_ABORT);
    env->DeleteLocalRef(digestBytes);
    env->DeleteLocalRef(md);
    env->DeleteLocalRef(mdClass);

    return match ? JNI_TRUE : JNI_FALSE;
}