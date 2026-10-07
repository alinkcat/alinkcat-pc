package com.ailinkcat.mobile.ui.dialog

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import com.ailinkcat.mobile.utils.FileUtils
import com.ailinkcat.mobile.websocket.models.ReceiveState
import com.ailinkcat.mobile.websocket.models.ReceiveStatus

/**
 * Theme pack transfer progress dialog. Back/outside dismissal is off so the
 * transfer can't be interrupted by accident; cancel while receiving (reject
 * at the start), close when done (auto-closes after 3s via the ViewModel).
 * Stays open on INTERRUPTED while waiting for a resume.
 */
@Composable
fun ReceiveProgressDialog(
    state: ReceiveState,
    onCancel: () -> Unit,
    onClose: () -> Unit
) {
    val statusColor = when (state.status) {
        ReceiveStatus.COMPLETED -> SuccessGreen
        ReceiveStatus.CANCELLED, ReceiveStatus.FAILED -> ErrorRed
        ReceiveStatus.INTERRUPTED -> WarningOrange
        else -> MaterialTheme.colorScheme.primary
    }

    Dialog(
        onDismissRequest = { },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📥", fontSize = 22.sp)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.receiving_theme), style = MaterialTheme.typography.titleMedium)
                }

                Spacer(Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.theme_info, state.themeName, state.version),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.size_format, FileUtils.formatSize(state.totalSize)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    LinearProgressIndicator(
                        progress = { state.progress.coerceIn(0f, 1f) },
                        modifier = Modifier
                            .weight(1f)
                            .height(8.dp),
                        color = statusColor,
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "${(state.progress.coerceIn(0f, 1f) * 100).toInt()}%",
                        style = MaterialTheme.typography.labelMedium,
                        color = statusColor
                    )
                }

                Spacer(Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.received_progress, FileUtils.formatSize(state.receivedSize), FileUtils.formatSize(state.totalSize)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(R.string.speed_format, FileUtils.formatSpeed(state.speed)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(12.dp))

                val statusTextRes = when (state.status) {
                    ReceiveStatus.COMPLETED -> R.string.status_completed
                    ReceiveStatus.CANCELLED -> R.string.status_cancelled
                    ReceiveStatus.FAILED -> R.string.status_failed
                    ReceiveStatus.INTERRUPTED -> R.string.status_interrupted
                    ReceiveStatus.RECEIVING -> R.string.status_receiving
                    ReceiveStatus.IDLE, ReceiveStatus.PENDING_CONFIRM -> R.string.status_preparing
                }
                Text(
                    text = stringResource(statusTextRes),
                    style = MaterialTheme.typography.titleSmall,
                    color = statusColor,
                    fontWeight = FontWeight.Bold
                )

                state.errorMessage?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = ErrorRed,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(Modifier.height(16.dp))

                if (state.status == ReceiveStatus.RECEIVING) {
                    val justStarted = state.receivedChunks == 0 && state.receivedSize == 0L
                    Button(
                        onClick = onCancel,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer
                        )
                    ) {
                        Text(if (justStarted) stringResource(R.string.reject_receive) else stringResource(R.string.cancel_receive))
                    }
                } else {
                    Button(onClick = onClose) {
                        Text(stringResource(R.string.close))
                    }
                }
            }
        }
    }
}
