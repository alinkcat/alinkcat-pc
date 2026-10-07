package com.ailinkcat.mobile.ui.render

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.domain.models.Theme
import com.ailinkcat.mobile.ui.render.components.DotsIndicator
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.IdleGray
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import java.io.File

/** theme render screen: loading / error / render states, immersive full-screen. */
@Composable
fun ThemeRenderScreen(
    viewModel: ThemeRenderViewModel,
    onExit: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(uiState.actionError) {
        uiState.actionError?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearActionError()
        }
    }

    // only subscribe once the theme actually loads; the error page never opens the websocket
    LaunchedEffect(uiState.theme) {
        uiState.theme?.let { viewModel.enterTheme() }
    }
    DisposableEffect(Unit) {
        onDispose { viewModel.leaveTheme() }
    }

    when {
        uiState.loading -> LoadingView()
        uiState.error != null -> ErrorView(
            message = uiState.error,
            onRetry = viewModel::retry,
            onExit = onExit
        )

        uiState.theme != null -> RenderContent(
            theme = uiState.theme!!,
            viewModel = viewModel,
            uiState = uiState,
            onExit = onExit
        )
    }
}

@Composable
private fun LoadingView() {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF101320)),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun ErrorView(message: String?, onRetry: () -> Unit, onExit: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF101320)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp)
        ) {
            Text("😿", fontSize = 48.sp)
            Spacer(Modifier.height(12.dp))
            Text(
                text = message ?: stringResource(R.string.theme_load_failed),
                color = Color.White,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(16.dp))
            Row {
                TextButton(onClick = onRetry) { Text(stringResource(R.string.retry), color = Color.White) }
                TextButton(onClick = onExit) { Text(stringResource(R.string.back), color = Color.White) }
            }
        }
    }
}

@Composable
private fun RenderContent(
    theme: Theme,
    viewModel: ThemeRenderViewModel,
    uiState: ThemeRenderViewModel.RenderUiState,
    onExit: () -> Unit
) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(pageCount = { theme.pages.size })
    val themeDir = File(context.filesDir, "themes")

    // theme has no pages: show a message instead of a black screen
    if (theme.pages.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xFF101320)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("😿", fontSize = 48.sp)
                Spacer(Modifier.height(12.dp))
                Text(
                    text = stringResource(R.string.theme_load_failed),
                    color = Color.White,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = onExit) { Text(stringResource(R.string.back), color = Color.White) }
            }
        }
        return
    }

    LaunchedEffect(pagerState.currentPage) {
        viewModel.onPageChanged(pagerState.currentPage)
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isLandscape = maxWidth > maxHeight

        // controls auto-hide after 3s, tap to wake; always visible while disconnected
        val isConnected = uiState.connectionStatus == ConnectionStatus.Connected
        var showControls by remember { mutableStateOf(true) }

        fun wakeControls() { showControls = true }

        LaunchedEffect(showControls, isConnected) {
            if (isConnected && showControls) {
                kotlinx.coroutines.delay(3000)
                showControls = false
            }
        }

        Box(modifier = Modifier.fillMaxSize()) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { index ->
                theme.pages.getOrNull(index)?.let { page ->
                    PageRenderer(
                        page = page,
                        themeId = theme.id,
                        themeDir = themeDir,
                        widgetData = uiState.widgetData,
                        mediaState = uiState.mediaState,
                        isLandscape = isLandscape,
                        onButtonClick = { widgetId, action -> viewModel.executeAction(widgetId, action) },
                        onSnippetClick = { content -> viewModel.executeSnippet(content) }
                    )
                }
            }

            // invisible tap strip along the top; scoped to 40dp so pager swipes still work
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .height(40.dp)
                    .pointerInput(Unit) {
                        detectTapGestures { wakeControls() }
                    }
            )

            AnimatedVisibility(
                visible = showControls || !isConnected,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .windowInsetsPadding(
                        WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
                    )
            ) {
                Box(
                    modifier = Modifier
                        .padding(8.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.Black.copy(alpha = 0.35f))
                        .clickable { viewModel.requestExit(); wakeControls() }
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Text("✕", color = Color.White, fontSize = 16.sp)
                }
            }

            AnimatedVisibility(
                visible = showControls || !isConnected,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .windowInsetsPadding(
                        WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
                    )
            ) {
                Row(
                    modifier = Modifier
                        .padding(12.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color.Black.copy(alpha = 0.35f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val (dotColor, labelRes) = when (uiState.connectionStatus) {
                        ConnectionStatus.Connected -> SuccessGreen to R.string.connected
                        ConnectionStatus.Connecting -> WarningOrange to R.string.connecting
                        ConnectionStatus.Error -> ErrorRed to R.string.connection_failed
                        else -> IdleGray to R.string.disconnected
                    }
                    Box(
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(dotColor)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(labelRes), color = Color.White, fontSize = 12.sp)
                }
            }

            if (theme.pages.size > 1) {
                DotsIndicator(
                    pageCount = theme.pages.size,
                    currentPage = pagerState.currentPage,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .windowInsetsPadding(
                            WindowInsets.safeDrawing.only(
                                WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal
                            )
                        )
                        .padding(bottom = 12.dp)
                )
            }
        }
    }

    if (uiState.showExitConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::dismissExitConfirm,
            title = { Text(stringResource(R.string.exit_theme)) },
            text = { Text(stringResource(R.string.exit_theme_confirm)) },
            confirmButton = {
                TextButton(onClick = {
                    // leaveTheme runs from DisposableEffect's onDispose; don't send it twice
                    viewModel.releaseConnection()
                    onExit()
                }) {
                    Text(stringResource(R.string.exit))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissExitConfirm) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }
}
