# ============================================================
# Alinkcat ProGuard / R8 混淆规则
# ============================================================
# 原则：只保留必须的，让所有项目类名被混淆为 a/b/c

# ── 保留 Compose 编译器需要的 @Composable 方法（必须） ──
-keepclassmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}
-dontwarn androidx.compose.**

# ── 保留 Kotlin 协程 ─────────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-dontwarn kotlinx.coroutines.**

# ── 保留 OkHttp / WebSocket ──────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ── 保留 EncryptedSharedPreferences ──────────────────────
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# ── 保留 CameraX ────────────────────────────────────────
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ── 保留 ZXing ──────────────────────────────────────────
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ── 保留 Coil ───────────────────────────────────────────
-keep class coil.** { *; }
-dontwarn coil.**

# ── 保留 JSON 解析相关 ──────────────────────────────────
-dontwarn org.json.**

# ── 保留 Manifest 中声明的 Activity（必须） ─────────────
-keep class com.ailinkcat.mobile.MainActivity { *; }
-keep class com.ailinkcat.mobile.ui.render.ThemeRenderActivity { *; }

# ── 保留 JNI Native 接口（方法名绑定 .so 符号） ────────
-keep class com.ailinkcat.mobile.utils.NativeSignatureChecker { *; }

# ── 通用规则 ────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses