package com.ailinkcat.mobile.ui.config

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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.IdleGray
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import org.json.JSONObject

/** connection config tab: form, scan-to-fill (opens ScannerScreen), history, status. */
@Composable
fun ConfigScreen(
    viewModel: ConnectionViewModel,
    onOpenScanner: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val config by viewModel.savedConfig.collectAsStateWithLifecycle()
    val pendingScan by viewModel.pendingScanResult.collectAsStateWithLifecycle()

    var ip by remember { mutableStateOf(config.ip) }
    var port by remember { mutableStateOf(config.port) }
    var pairCode by remember { mutableStateOf(config.pairCode) }
    // only fill the form once, otherwise a config refresh after connect clobbers in-progress edits
    var formInitialized by remember { mutableStateOf(false) }

    LaunchedEffect(config) {
        if (!formInitialized) {
            ip = config.ip
            port = config.port
            if (pairCode.isBlank()) pairCode = config.pairCode
            formInitialized = true
        }
    }

    LaunchedEffect(pendingScan) {
        val content = pendingScan ?: return@LaunchedEffect
        applyScanContent(content)?.let { (newIp, newPort, newCode) ->
            ip = newIp
            port = newPort
            pairCode = newCode
        }
        viewModel.consumeScanResult()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = stringResource(R.string.connection_status),
                        style = MaterialTheme.typography.titleSmall
                    )
                    Spacer(Modifier.weight(1f))
                    ConnectionStatusChip(status = state.status)
                }
                state.errorMessage?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = ErrorRed
                    )
                }
                state.deviceName?.let {
                    if (state.status == ConnectionStatus.Connected) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = stringResource(R.string.connected_pc, it, state.serverVersion?.let { v -> " (v$v)" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = ip,
                    onValueChange = { ip = it },
                    label = { Text(stringResource(R.string.pc_ip_address)) },
                    placeholder = { Text("192.168.1.100") },
                    singleLine = true,
                    leadingIcon = { Text("🌐") },
                    trailingIcon = {
                        IconButton(onClick = onOpenScanner) {
                            Text("📷", fontSize = 20.sp)
                        }
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = port,
                    onValueChange = { input -> port = input.filter { it.isDigit() }.take(5) },
                    label = { Text(stringResource(R.string.port_number)) },
                    placeholder = { Text("9527") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = pairCode,
                    onValueChange = { input -> pairCode = input.filter { it.isDigit() }.take(4) },
                    label = { Text(stringResource(R.string.pairing_code)) },
                    placeholder = { Text(stringResource(R.string.enter_pairing_code)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = stringResource(R.string.pairing_code_hint),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (config.lastConnectedIp.isNotBlank()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("🕘", fontSize = 18.sp)
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.last_successful_connection),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${config.lastConnectedIp}:${config.lastConnectedPort}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    TextButton(onClick = {
                        ip = config.lastConnectedIp
                        port = config.lastConnectedPort
                    }) {
                        Text(stringResource(R.string.fill_in))
                    }
                }
            }
        }

        Button(
            onClick = { viewModel.connect(ip.trim(), port.trim(), pairCode.trim()) },
            enabled = state.status != ConnectionStatus.Connecting,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
        ) {
            if (state.status == ConnectionStatus.Connecting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.connecting_ellipsis))
            } else {
                Text(stringResource(R.string.connect), fontSize = 16.sp)
            }
        }

        if (state.status == ConnectionStatus.Connected) {
            OutlinedButton(
                onClick = { viewModel.disconnect() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Text(stringResource(R.string.disconnect))
            }
        }
    }
}

@Composable
fun ConnectionStatusChip(status: ConnectionStatus) {
    val (background, foreground, labelRes) = when (status) {
        ConnectionStatus.Connected ->
            Triple(Color(0xFFE6F7EC), SuccessGreen, R.string.connected)
        ConnectionStatus.Connecting ->
            Triple(Color(0xFFFFF3E0), WarningOrange, R.string.connecting)
        ConnectionStatus.Error ->
            Triple(Color(0xFFFDECEA), ErrorRed, R.string.connection_failed)
        else ->
            Triple(Color(0xFFEEEEEE), IdleGray, R.string.disconnected)
    }
    Surface(shape = RoundedCornerShape(50), color = background) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ConnectionStatusDot(status = status, color = foreground)
            Spacer(Modifier.width(6.dp))
            Text(
                text = stringResource(labelRes),
                style = MaterialTheme.typography.labelMedium,
                color = foreground
            )
        }
    }
}

/** status dot: gray when idle, spinning ring while connecting, green when connected. */
@Composable
private fun ConnectionStatusDot(status: ConnectionStatus, color: Color) {
    if (status == ConnectionStatus.Connecting) {
        val transition = rememberInfiniteTransition(label = "connecting")
        val angle by transition.animateFloat(
            initialValue = 0f,
            targetValue = 360f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 900, easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "angle"
        )
        Canvas(modifier = Modifier.size(14.dp)) {
            val stroke = 2.dp.toPx()
            drawArc(
                color = color,
                startAngle = angle,
                sweepAngle = 280f,
                useCenter = false,
                topLeft = Offset(stroke / 2, stroke / 2),
                size = Size(size.width - stroke, size.height - stroke),
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )
        }
    } else {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(color, CircleShape)
        )
    }
}

/**
 * Parses scan results as JSON ({"ip","port","pairCode"}), a ws:// URL or plain
 * ip:port:code text. Tries JSONObject first (works on device), falls back to
 * regex parsing so JVM unit tests can exercise it too.
 */
fun applyScanContent(content: String): Triple<String, String, String>? {
    var newIp: String? = null
    var newPort: String? = null
    var newCode: String? = null

    val jsonParsed = try {
        val json = JSONObject(content)
        newIp = json.optString("ip").takeIf { it.isNotBlank() }
        newPort = json.optString("port").takeIf { it.isNotBlank() }
        newCode = json.optString("pairCode").ifBlank { json.optString("pair_code") }
            .takeIf { it.isNotBlank() }
        true
    } catch (_: Exception) {
        false
    }

    if (!jsonParsed) {
        Regex("\\d{1,3}(\\.\\d{1,3}){3}").find(content)?.let { newIp = it.value }

        Regex("\"? (?:port|pairCode|pair_code)\"?\\s*[:=]\\s*\"?([0-9A-Za-z.-]+)\"?", RegexOption.IGNORE_CASE)
            .findAll(content)
            .forEach { match ->
                val key = match.groupValues[0]
                val value = match.groupValues[1]
                when {
                    key.contains("port", ignoreCase = true) &&
                        value.all { it.isDigit() } && newPort == null -> newPort = value

                    (key.contains("pair", ignoreCase = true) || key.contains("code", ignoreCase = true)) &&
                        value.length == 4 && value.all { it.isDigit() } && newCode == null -> newCode = value
                }
            }

        if (newPort == null) {
            Regex("(?:[:=/\\s\"])(\\d{2,5})(?![\\d.])").find(content)?.let {
                val candidate = it.groupValues[1]
                if (candidate != newIp?.replace(".", "")) newPort = candidate
            }
        }
        if (newCode == null) {
            Regex("(?:pair(?:Code|_code)?|code)[=:]*\"?([0-9]{4})", RegexOption.IGNORE_CASE)
                .find(content)?.let { newCode = it.groupValues[1] }
            if (newCode == null) {
                Regex("\\b([0-9]{4})\\b").findAll(content).forEach { match ->
                    val candidate = match.groupValues[1]
                    if (candidate != newPort) {
                        newCode = candidate
                        return@forEach
                    }
                }
            }
        }
    }

    newIp ?: return null
    // validate everything before filling, so crafted qr content can't smuggle
    // something like http://evil.com into ws://$ip:$port
    if (!isValidIpv4(newIp)) return null
    val portInt = (newPort ?: "9527").toIntOrNull()
    if (portInt == null || portInt !in 1..65535) return null
    val code = newCode ?: ""
    if (code.isNotEmpty() && !(code.length == 4 && code.all { it.isDigit() })) return null
    return Triple(newIp, portInt.toString(), code)
}

fun isValidIpv4(ip: String?): Boolean {
    if (ip.isNullOrBlank()) return false
    val segments = ip.split('.')
    if (segments.size != 4) return false
    return segments.all { seg ->
        seg.isNotEmpty() && seg.length <= 3 && seg.all { it.isDigit() } &&
            seg.toInt() in 0..255 && (seg.length == 1 || !seg.startsWith("0"))
    }
}
