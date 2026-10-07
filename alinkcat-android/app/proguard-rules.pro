# ============================================================
# Alinkcat ProGuard / R8 rules
# ============================================================
# keep only what's required, let everything else get renamed to a/b/c

# ── @Composable methods required by the compose compiler ──
-keepclassmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}
-dontwarn androidx.compose.**

# ── kotlin coroutines ─────────────────────────────────────
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-dontwarn kotlinx.coroutines.**

# ── OkHttp / WebSocket ───────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ── EncryptedSharedPreferences ───────────────────────────
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# ── CameraX ──────────────────────────────────────────────
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ── ZXing ────────────────────────────────────────────────
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ── Coil ─────────────────────────────────────────────────
-keep class coil.** { *; }
-dontwarn coil.**

# ── org.json ─────────────────────────────────────────────
-dontwarn org.json.**

# ── widget data classes, json reflection relies on field names ──
-keep class com.ailinkcat.mobile.domain.models.** { *; }

# ── activities declared in the manifest ──────────────────
-keep class com.ailinkcat.mobile.MainActivity { *; }
-keep class com.ailinkcat.mobile.ui.render.ThemeRenderActivity { *; }

# ── JNI interface, method names bind to .so symbols ──────
-keep class com.ailinkcat.mobile.utils.NativeSignatureChecker { *; }

# ── general ──────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses