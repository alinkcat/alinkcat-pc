#include <jni.h>
#include <string>
#include <cstring>
#include <fstream>

// 期望签名证书的 MD5 摘要（16 字节）
// 对应 MD5: 2F:08:75:CA:C8:A1:DE:F4:46:DE:C4:B3:78:94:07:B9
// 存储在 .rodata 段，无导出符号；反编译 DEX 不可见
static const uint8_t EXPECTED[16] = {
    0x2Fu, 0x08u, 0x75u, 0xCAu,
    0xC8u, 0xA1u, 0xDEu, 0xF4u,
    0x46u, 0xDEu, 0xC4u, 0xB3u,
    0x78u, 0x94u, 0x07u, 0xB9u
};

// 反调试：读取 /proc/self/status 的 TracerPid

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

// 常量时间比较（防时序攻击）

static bool constant_time_compare(const uint8_t *a, const uint8_t *b, size_t len) {
    uint8_t diff = 0;
    for (size_t i = 0; i < len; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff == 0;
}

// JNI 接口
// 通过 JNI 调用系统 MessageDigest 计算 MD5；期望值与比较逻辑留在 native，
// 攻击者无法通过 patch Java 绕过。

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