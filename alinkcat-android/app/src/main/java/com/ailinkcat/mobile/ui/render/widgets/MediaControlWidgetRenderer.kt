package com.ailinkcat.mobile.ui.render.widgets

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.TextUnit
import coil.compose.AsyncImage
import com.ailinkcat.mobile.domain.models.MediaControlWidget
import com.ailinkcat.mobile.domain.models.MediaState
import androidx.compose.ui.res.stringResource
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.utils.FileUtils
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Interpolates the progress bar locally at 60fps instead of waiting for pushes.
 * remember/LaunchedEffect keys must stay in sync so a position change doesn't
 * freeze or rewind the bar; rebuilds the baseline when baseSystemTime <= 0;
 * clamps to [0, duration].
 */
@Composable
private fun useDisplayPosition(state: MediaState): Float {
    val displayPos = remember(
        state.basePosition, state.baseSystemTime, state.isPlaying, state.position, state.duration
    ) {
        mutableStateOf(state.position.toFloat())
    }
    LaunchedEffect(state.isPlaying, state.basePosition, state.baseSystemTime, state.position, state.duration) {
        if (!state.isPlaying || state.duration <= 0L) {
            displayPos.value = state.position.toFloat()
            return@LaunchedEffect
        }
        // fallback baseline when baseSystemTime <= 0 (MediaState's default)
        val baseTime = if (state.baseSystemTime > 0L) state.baseSystemTime else System.currentTimeMillis()
        val basePos = if (state.baseSystemTime > 0L) state.basePosition else state.position
        while (true) {
            withFrameNanos {
                val elapsed = (System.currentTimeMillis() - baseTime).coerceAtLeast(0)
                val interpolated = basePos + elapsed
                displayPos.value = interpolated.toFloat().coerceIn(0f, state.duration.toFloat())
            }
        }
    }
    return displayPos.value
}

/** media player card: cover, title, progress, controls. displayMode = always / playing_only. */
@Composable
fun MediaControlWidgetRenderer(
    widget: MediaControlWidget,
    mediaState: MediaState,
    onPlayPause: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onVolumeChange: (Int) -> Unit = {}
) {
    val showComponent = widget.displayMode != "playing_only" || mediaState.isPlaying
    val isActive = mediaState.isPlaying || widget.displayMode == "always"

    AnimatedVisibility(
        visible = showComponent,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        if (isActive) {
            ActiveMediaCard(widget, mediaState, onPlayPause, onPrev, onNext, onVolumeChange)
        } else {
            PlaceholderMediaCard(widget, onPlayPause)
        }
    }
}

@Composable
private fun ActiveMediaCard(
    widget: MediaControlWidget,
    state: MediaState,
    onPlayPause: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onVolumeChange: (Int) -> Unit
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp)
    ) {
        val cw = maxWidth.value
        val ch = maxHeight.value
        when {
            // full card needs ~280dp of width for cover + text + controls
            cw >= 280f && ch >= 130f ->
                FullMediaLayout(widget, state, cw, ch, onPlayPause, onPrev, onNext, onVolumeChange)
            cw >= 170f && ch >= 70f ->
                CompactMediaLayout(widget, state, cw, ch, onPlayPause, onPrev, onNext)
            else ->
                MiniMediaLayout(widget, state, cw, ch, onPlayPause, onNext)
        }
    }
}

@Composable
private fun MediaCardBackground(content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(14.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        Color(0xCC1E1E2E),
                        Color(0xCC2A1A3A)
                    )
                )
            ),
        verticalAlignment = Alignment.CenterVertically,
        content = content
    )
}

@Composable
private fun CoverImage(state: MediaState, size: Int) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF333344)),
        contentAlignment = Alignment.Center
    ) {
        if (state.coverUrl.isNullOrBlank()) {
            Text("🎵", fontSize = (size * 0.5f).sp)
        } else {
            AsyncImage(
                model = state.coverUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

/** full layout: cover + title/artist/progress/controls/volume, for large cells */
@Composable
private fun FullMediaLayout(
    widget: MediaControlWidget,
    state: MediaState,
    cw: Float,
    ch: Float,
    onPlayPause: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onVolumeChange: (Int) -> Unit
) {
    MediaCardBackground {
        val coverSize = (ch - 16f).coerceAtMost(cw * 0.18f).toInt()
        val titleSize = (cw * 0.045f).coerceIn(11f, 18f).sp
        val artistSize = (cw * 0.035f).coerceIn(9f, 14f).sp
        val timeSize = (cw * 0.03f).coerceIn(8f, 11f).sp
        val btnSize = (cw * 0.07f).coerceIn(24f, 40f)

        if (widget.showCover) {
            Box(modifier = Modifier.padding(8.dp)) {
                CoverImage(state, coverSize)
            }
            Spacer(Modifier.width(10.dp))
        }

        // scrollable when the cell is short so progress/volume don't get crushed
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = state.title ?: stringResource(R.string.not_playing),
                color = Color.White,
                fontSize = titleSize,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = state.artist ?: "",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = artistSize,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            MediaProgressSection(showProgress = widget.showProgress, state = state, timeSize = timeSize)

            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                ControlButton("⏮", btnSize, onPrev)
                Spacer(Modifier.width((btnSize * 0.6f).dp))
                ControlButton(
                    text = if (state.isPlaying) "⏸" else "▶️",
                    size = btnSize,
                    onClick = onPlayPause
                )
                Spacer(Modifier.width((btnSize * 0.6f).dp))
                ControlButton("⏭", btnSize, onNext)
            }

            // volume
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(32.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("🔊", fontSize = (timeSize.value + 2).sp, color = Color.White.copy(alpha = 0.5f))
                Spacer(Modifier.width(6.dp))
                // clamp to 0..100; the backend can push out-of-range values
                val clampedVolume = state.volume.coerceIn(0, 100)
                val sliderVolume = remember(clampedVolume) { mutableStateOf(clampedVolume.toFloat()) }
                Slider(
                    value = sliderVolume.value,
                    onValueChange = { sliderVolume.value = it },
                    onValueChangeFinished = { onVolumeChange(sliderVolume.value.roundToInt().coerceIn(0, 100)) },
                    valueRange = 0f..100f,
                    modifier = Modifier
                        .weight(1f)
                        .height(32.dp),
                    colors = SliderDefaults.colors(
                        thumbColor = Color(0xFF4F6EF7),
                        activeTrackColor = Color(0xFF4F6EF7),
                        inactiveTrackColor = Color.White.copy(alpha = 0.15f)
                    )
                )
                Text(
                    text = String.format("%.0f", sliderVolume.value),
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = timeSize
                )
            }
        }
    }
}

/** compact layout: cover + text + progress + controls, volume hidden below ~280dp width */
@Composable
private fun CompactMediaLayout(
    widget: MediaControlWidget,
    state: MediaState,
    cw: Float,
    ch: Float,
    onPlayPause: () -> Unit,
    onPrev: () -> Unit,
    onNext: () -> Unit
) {
    MediaCardBackground {
        val coverSize = (ch - 12f).coerceAtMost(52f).toInt()
        val titleSize = (cw * 0.055f).coerceIn(11f, 15f).sp
        val artistSize = (cw * 0.04f).coerceIn(9f, 12f).sp
        val timeSize = 9.sp
        val btnPlay = 30f
        val btnSide = 22f

        if (widget.showCover) {
            Box(modifier = Modifier.padding(6.dp)) {
                CoverImage(state, coverSize)
            }
            Spacer(Modifier.width(8.dp))
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(vertical = 4.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = state.title ?: stringResource(R.string.not_playing),
                color = Color.White,
                fontSize = titleSize,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (widget.showProgress && state.duration > 0L) {
                Spacer(Modifier.height(3.dp))
                val progress = useDisplayPosition(state)
                LinearProgressIndicator(
                    progress = { (progress / state.duration.toFloat()).coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = Color(0xFF4F6EF7),
                    trackColor = Color.White.copy(alpha = 0.15f)
                )
            } else if (!state.artist.isNullOrBlank()) {
                Text(
                    text = state.artist,
                    color = Color.White.copy(alpha = 0.6f),
                    fontSize = artistSize,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                ControlButton("⏮", btnSide, onPrev)
                Spacer(Modifier.width(12.dp))
                ControlButton(
                    text = if (state.isPlaying) "⏸" else "▶️",
                    size = btnPlay,
                    onClick = onPlayPause
                )
                Spacer(Modifier.width(12.dp))
                ControlButton("⏭", btnSide, onNext)
            }
        }
    }
}

/** mini layout (1x1-ish cells): just cover + play/next, everything else dropped */
@Composable
private fun MiniMediaLayout(
    widget: MediaControlWidget,
    state: MediaState,
    cw: Float,
    ch: Float,
    onPlayPause: () -> Unit,
    onNext: () -> Unit
) {
    MediaCardBackground {
        val btn = (ch * 0.62f).coerceIn(26f, 40f)
        if (widget.showCover && cw >= 100f) {
            Box(modifier = Modifier.padding(5.dp)) {
                CoverImage(state, (ch - 10f).toInt())
            }
            Spacer(Modifier.width(8.dp))
        }
        ControlButton(
            text = if (state.isPlaying) "⏸" else "▶️",
            size = btn,
            onClick = onPlayPause
        )
        if (cw >= 120f) {
            Spacer(Modifier.width(10.dp))
            ControlButton("⏭", btn * 0.8f, onNext)
        }
    }
}

/** progress + time; the 60fps interpolation state stays local so siblings don't recompose every frame. */
@Composable
private fun MediaProgressSection(showProgress: Boolean, state: MediaState, timeSize: TextUnit) {
    if (!showProgress || state.duration <= 0L) return
    val displayPosition = useDisplayPosition(state)
    Spacer(Modifier.height(4.dp))
    val progress = (displayPosition / state.duration.toFloat()).coerceIn(0f, 1f)
    LinearProgressIndicator(
        progress = { progress },
        modifier = Modifier
            .fillMaxWidth()
            .height(3.dp)
            .clip(RoundedCornerShape(2.dp)),
        color = Color(0xFF4F6EF7),
        trackColor = Color.White.copy(alpha = 0.15f)
    )
    Spacer(Modifier.height(2.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = formatDuration(displayPosition.toLong()),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = timeSize
        )
        Text(
            text = formatDuration(state.duration),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = timeSize
        )
    }
}

@Composable
private fun PlaceholderMediaCard(widget: MediaControlWidget, onPlayPause: () -> Unit = {}) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(4.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0x661E1E2E)),
        contentAlignment = Alignment.Center
    ) {
        if (maxHeight < 70.dp) {
            // small cell: play button only
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.12f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onPlayPause
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("▶️", fontSize = 15.sp)
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color(0x33FFFFFF)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🎵", fontSize = 18.sp, color = Color.White.copy(alpha = 0.3f))
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = widget.label,
                    color = Color.White.copy(alpha = 0.4f),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )
                Spacer(Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onPlayPause
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("▶️", fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun ControlButton(
    text: String,
    size: Float,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.10f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = (size * 0.5f).sp
        )
    }
}

private fun formatDuration(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSec = (ms / 1000).toInt()
    val m = totalSec / 60
    val s = totalSec % 60
    return "$m:${s.toString().padStart(2, '0')}"
}