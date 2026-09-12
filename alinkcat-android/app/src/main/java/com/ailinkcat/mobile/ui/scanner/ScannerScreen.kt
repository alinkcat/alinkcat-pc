package com.ailinkcat.mobile.ui.scanner

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.ailinkcat.mobile.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max

private val ScanGreen = Color(0xFF00E676)
private val ScrimColor = Color.Black.copy(alpha = 0.55f)

/**
 * 扫码页：CameraX 实时预览 + ZXing 解码 + 自定义扫描框视觉引导。
 * 扫码成功 -> 震动反馈 -> 回调结果并自动关闭。
 */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun ScannerScreen(
    onResult: (String) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)

    // 防止重复触发
    val decoded = remember { AtomicBoolean(false) }

    fun handleContent(content: String) {
        if (decoded.compareAndSet(false, true)) {
            vibrate(context)
            onResult(content)
        }
    }

    val albumLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            scope.launch {
                val content = withContext(Dispatchers.IO) { decodeImageFromUri(context, it) }
                content?.let(::handleContent)
            }
        }
    }

    // 相机预览需先创建，以便绑定 surfaceProvider
    val previewView = remember { PreviewView(context) }

    // 相机绑定状态：错误信息、重试计数、已绑定 provider（dispose 时解绑）
    var cameraError by remember { mutableStateOf<String?>(null) }
    var retryNonce by remember { mutableIntStateOf(0) }
    val boundProvider = remember { mutableStateOf<ProcessCameraProvider?>(null) }

    // 协程等待 CameraX 就绪，dispose 时随协程取消
    DisposableEffect(lifecycleOwner, cameraPermission.status.isGranted, retryNonce) {
        if (!cameraPermission.status.isGranted) {
            onDispose {}
        } else {
            cameraError = null
            val analyzerExecutor = Executors.newSingleThreadExecutor()
            val job = scope.launch {
                try {
                    val cameraProvider = awaitCameraProvider(context)
                    boundProvider.value = cameraProvider
                    val preview = Preview.Builder().build().also {
                        it.setSurfaceProvider(previewView.surfaceProvider)
                    }
                    startCamera(
                        context = context,
                        lifecycleOwner = lifecycleOwner,
                        cameraProvider = cameraProvider,
                        preview = preview,
                        analyzerExecutor = analyzerExecutor,
                        onQrDetected = { content ->
                            analyzerExecutor.shutdown()
                            scope.launch { handleContent(content) }
                        }
                    )
                } catch (e: Exception) {
                    // 绑定失败：置错误状态，渲染重试 UI
                    Log.e("ScannerScreen", "Camera bind failed", e)
                    cameraError = e.message ?: "相机启动失败"
                }
            }

            onDispose {
                job.cancel()
                // 已就绪的 provider 解绑；未就绪的已随协程取消
                boundProvider.value?.let { provider ->
                    runCatching { provider.unbindAll() }
                }
                analyzerExecutor.shutdown()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (cameraPermission.status.isGranted) {
            AndroidView(
                factory = { previewView },
                modifier = Modifier.fillMaxSize()
            )
        }

        when {
            cameraError != null -> CameraErrorView(
                message = cameraError ?: "",
                onRetry = { retryNonce++ },
                onCancel = onCancel
            )
            decoded.get() -> RescanOverlay(
                onRescan = { decoded.set(false) },
                onCancel = onCancel
            )
            cameraPermission.status.isGranted -> ScanOverlay(
                onCancel = onCancel,
                onPickAlbum = { albumLauncher.launch("image/*") }
            )
            else -> PermissionRequestView(
                onRequest = { cameraPermission.launchPermissionRequest() }
            )
        }
    }
}

/**
 * 协程化等待 CameraX 就绪：future 完成前可被取消（dispose）。
 * listener 内检查 isActive，避免 resume 已取消的协程。
 */
private suspend fun awaitCameraProvider(context: Context): ProcessCameraProvider =
    suspendCancellableCoroutine { cont ->
        val future = ProcessCameraProvider.getInstance(context)
        val listener = Runnable {
            if (cont.isActive) {
                try {
                    cont.resume(future.get())
                } catch (e: Exception) {
                    cont.resumeWithException(e)
                }
            }
        }
        future.addListener(listener, ContextCompat.getMainExecutor(context))
        // 不在取消时移除 listener：由 isActive 检查保证不会 resume 已取消的协程
        cont.invokeOnCancellation { }
    }

@Suppress("DEPRECATION")
private fun startCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    cameraProvider: ProcessCameraProvider,
    preview: Preview,
    analyzerExecutor: java.util.concurrent.ExecutorService,
    onQrDetected: (String) -> Unit
) {
    val analysis = ImageAnalysis.Builder()
        .setTargetResolution(Size(1280, 720))
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
    analysis.setAnalyzer(analyzerExecutor, QrAnalyzer(onQrDetected))

    // 异常由调用方捕获并置错误状态
    cameraProvider.unbindAll()
    cameraProvider.bindToLifecycle(
        lifecycleOwner,
        CameraSelector.DEFAULT_BACK_CAMERA,
        preview,
        analysis
    )
}

/**
 * 解码帧图像（YUV_420_888 -> PlanarYUVLuminanceSource -> ZXing）。
 */
private class QrAnalyzer(
    private val onQrDetected: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private val hints = mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE))

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(image: ImageProxy) {
        val text = try {
            if (image.format != ImageFormat.YUV_420_888) {
                null
            } else {
                val plane = image.planes[0]
                val buffer = plane.buffer
                val bytes = ByteArray(buffer.remaining())
                buffer.get(bytes)
                val source = PlanarYUVLuminanceSource(
                    bytes,
                    plane.rowStride,
                    image.height,
                    0,
                    0,
                    image.width,
                    image.height,
                    false
                )
                QRCodeReader()
                    .decode(BinaryBitmap(HybridBinarizer(source)), hints)
                    .text
            }
        } catch (_: Exception) {
            null
        } finally {
            image.close()
        }
        text?.let(onQrDetected)
    }
}

/**
 * 从相册图片解码二维码（先 inJustDecodeBounds 预检尺寸并采样到 ≤1024 再解码，
 * 避免 12MP 原图 ≈48MB + getPixels 再一份的内存峰值）。
 */
private fun decodeImageFromUri(context: Context, uri: Uri): String? {
    return try {
        // 第一遍：仅读边界，确定采样率
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { input ->
            BitmapFactory.decodeStream(input, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2

        // 第二遍：按采样率解码
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val input2 = context.contentResolver.openInputStream(uri) ?: return null
        val bitmap = input2.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null

        val scaled = scaleDown(bitmap, 1024)
        val pixels = IntArray(scaled.width * scaled.height)
        scaled.getPixels(pixels, 0, scaled.width, 0, 0, scaled.width, scaled.height)
        val source = RGBLuminanceSource(scaled.width, scaled.height, pixels)
        QRCodeReader()
            .decode(
                BinaryBitmap(HybridBinarizer(source)),
                mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE))
            )
            .text
    } catch (_: Exception) {
        null
    }
}

private fun scaleDown(bitmap: Bitmap, maxDimension: Int): Bitmap {
    val maxSide = max(bitmap.width, bitmap.height)
    if (maxSide <= maxDimension) return bitmap
    val ratio = maxDimension.toFloat() / maxSide
    val w = (bitmap.width * ratio).toInt().coerceAtLeast(1)
    val h = (bitmap.height * ratio).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bitmap, w, h, true)
}

@Suppress("DEPRECATION")
private fun vibrate(context: Context) {
    try {
        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            vibrator.vibrate(200)
        }
    } catch (_: SecurityException) {
        // 缺 VIBRATE 权限时静默跳过
    } catch (_: Exception) {
        // 个别设备震动服务异常时静默跳过
    }
}

/**
 * 扫描框视觉引导层：
 * 70% 屏宽的方形框 + L 形角标 + 框外暗色遮罩 + 绿色渐变扫描线 + 提示文字 + 按钮。
 */
@Composable
private fun ScanOverlay(
    onCancel: () -> Unit,
    onPickAlbum: () -> Unit
) {
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val boxSize = maxWidth * 0.7f
        val left = (maxWidth - boxSize) / 2f
        val top = (maxHeight - boxSize) / 2f
        val lineHeight = 14.dp

        // 框外暗色遮罩（上下左右四块）
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(top)
                .background(ScrimColor)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .height(maxHeight - top - boxSize)
                .background(ScrimColor)
        )
        Box(
            modifier = Modifier
                .width(left)
                .height(boxSize)
                .offset(x = 0.dp, y = top)
                .background(ScrimColor)
        )
        Box(
            modifier = Modifier
                .width(left)
                .align(Alignment.TopEnd)
                .height(boxSize)
                .offset(y = top)
                .background(ScrimColor)
        )

        // L 形角标
        Box(
            modifier = Modifier
                .size(boxSize)
                .offset(x = left, y = top)
        ) {
            ScanCorners(color = ScanGreen)
        }

        // 扫描线动画
        val transition = rememberInfiniteTransition(label = "scanLine")
        val progress by transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 2200, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "scanProgress"
        )
        Box(
            modifier = Modifier
                .width(boxSize)
                .offset(x = left, y = top + (boxSize - lineHeight) * progress)
                .height(lineHeight)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            ScanGreen.copy(alpha = 0.35f),
                            ScanGreen,
                            ScanGreen.copy(alpha = 0.35f),
                            Color.Transparent
                        )
                    )
                )
        )

        // 上方提示文字
        Text(
            text = stringResource(R.string.scan_qr_hint),
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = (top - 56.dp).coerceAtLeast(24.dp))
        )

        // 下方按钮
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            OutlinedButton(
                onClick = onPickAlbum,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.height(44.dp)
            ) {
                Text(stringResource(R.string.album))
            }
            TextButton(onClick = onCancel) {
                Text(stringResource(R.string.cancel), color = Color.White, fontSize = 15.sp)
            }
        }
    }
}

@Composable
private fun ScanCorners(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val corner = 26.dp.toPx()
        val stroke = 4.dp.toPx()
        val w = size.width
        val h = size.height
        drawLine(color, Offset(0f, 0f), Offset(corner, 0f), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(0f, 0f), Offset(0f, corner), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(w, 0f), Offset(w - corner, 0f), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(w, 0f), Offset(w, corner), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(0f, h), Offset(corner, h), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(0f, h), Offset(0f, h - corner), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(w, h), Offset(w - corner, h), strokeWidth = stroke, cap = StrokeCap.Round)
        drawLine(color, Offset(w, h), Offset(w, h - corner), strokeWidth = stroke, cap = StrokeCap.Round)
    }
}

@Composable
private fun PermissionRequestView(onRequest: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("📷", fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(
            text = stringResource(R.string.camera_permission_needed),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRequest) {
            Text(stringResource(R.string.grant_camera))
        }
    }
}

/** 相机绑定失败提示 + 重试。 */
@Composable
private fun CameraErrorView(
    message: String,
    onRetry: () -> Unit,
    onCancel: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("⚠️", fontSize = 48.sp)
        Spacer(Modifier.height(12.dp))
        Text(
            text = "相机启动失败：$message",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(20.dp))
        Button(onClick = onRetry) {
            Text(stringResource(R.string.retry))
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onCancel) {
            Text(stringResource(R.string.cancel), color = Color.White)
        }
    }
}

/** 已识别到二维码后的「重新扫描 / 取消」操作层。 */
@Composable
private fun RescanOverlay(
    onRescan: () -> Unit,
    onCancel: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.scan_success),
                style = MaterialTheme.typography.titleMedium,
                color = Color.White
            )
            Button(onClick = onRescan) {
                Text(stringResource(R.string.rescan))
            }
            TextButton(onClick = onCancel) {
                Text(stringResource(R.string.cancel), color = Color.White)
            }
        }
    }
}
