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
import android.widget.Toast
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

/** scan screen: CameraX preview + ZXing decode. Success vibrates, returns the result and closes. */
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

    // one decode per scan
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
                if (content != null) {
                    handleContent(content)
                } else {
                    Toast.makeText(
                        context,
                        context.getString(R.string.qr_not_found_in_image),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    // created up front so the preview can bind its surfaceProvider
    val previewView = remember { PreviewView(context) }

    var cameraError by remember { mutableStateOf<String?>(null) }
    var retryNonce by remember { mutableIntStateOf(0) }
    val boundProvider = remember { mutableStateOf<ProcessCameraProvider?>(null) }

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
                    Log.e("ScannerScreen", "Camera bind failed", e)
                    cameraError = e.message ?: context.getString(R.string.camera_start_failed)
                }
            }

            onDispose {
                job.cancel()
                // only a bound provider needs unbinding; the rest is cancelled with the job
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
                onRequest = { cameraPermission.launchPermissionRequest() },
                onOpenSettings = {
                    context.startActivity(
                        android.content.Intent(
                            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            android.net.Uri.fromParts("package", context.packageName, null)
                        ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                }
            )
        }
    }
}

/**
 * Await CameraX readiness as a cancellable coroutine; the isActive check
 * guards against resuming an already-cancelled continuation.
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
        // listener isn't removed on cancellation; the isActive check covers it
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

    // exceptions are handled by the caller
    cameraProvider.unbindAll()
    cameraProvider.bindToLifecycle(
        lifecycleOwner,
        CameraSelector.DEFAULT_BACK_CAMERA,
        preview,
        analysis
    )
}

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

/** decode a QR from a gallery image; samples to <=1024 first so a 12MP photo doesn't spike memory */
private fun decodeImageFromUri(context: Context, uri: Uri): String? {
    return try {
        // pass 1: bounds only, to pick the sample size
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use { input ->
            BitmapFactory.decodeStream(input, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > 1024) sample *= 2

        // pass 2: decode with the sample size
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
        // no VIBRATE permission: skip silently
    } catch (_: Exception) {
        // some devices throw from the vibrator service; skip silently
    }
}

/** scan overlay: 70%-width frame, corner marks, dark scrim, animated scan line. */
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

        Box(
            modifier = Modifier
                .size(boxSize)
                .offset(x = left, y = top)
        ) {
            ScanCorners(color = ScanGreen)
        }

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

        Text(
            text = stringResource(R.string.scan_qr_hint),
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = (top - 56.dp).coerceAtLeast(24.dp))
        )

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
private fun PermissionRequestView(onRequest: () -> Unit, onOpenSettings: () -> Unit) {
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
        Spacer(Modifier.height(8.dp))
        // permanently denied users get nothing from re-requesting —
        // point them at the system settings page instead
        TextButton(onClick = onOpenSettings) {
            Text(
                text = stringResource(R.string.open_system_settings),
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 13.sp
            )
        }
    }
}

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
            text = stringResource(R.string.camera_start_failed_msg, message),
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
