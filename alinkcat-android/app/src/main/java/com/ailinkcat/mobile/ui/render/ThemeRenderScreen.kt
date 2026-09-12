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

/**
 * 主题包渲染主页面：加载 / 错误 / 渲染三态 + 全屏沉浸式交互。
 * 支持横竖屏自适应和安全区域（刘海屏/挖孔屏）适配。
 */
@Composable
fun ThemeRenderScreen(
    viewModel: ThemeRenderViewModel,
    onExit: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // 显示操作错误提示（如启动应用失败）
    LaunchedEffect(uiState.actionError) {
        uiState.actionError?.let { msg ->
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
            viewModel.clearActionError()
        }
    }

    // 主题加载成功后才进入订阅；错误页不连接 WebSocket（离开时取消）
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

    // 主题无页面：显示提示而非黑屏
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

    // 使用 BoxWithConstraints 检测屏幕方向
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isLandscape = maxWidth > maxHeight

        // 沉浸式隐藏：3 秒无操作自动隐藏顶部控件，点击唤醒，断开常显
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

            // 透明唤醒条——仅顶部 40dp 区域监听点击，不干扰 HorizontalPager 滑动
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .height(40.dp)
                    .pointerInput(Unit) {
                        detectTapGestures { wakeControls() }
                    }
            )

            // 顶部悬浮控件（渐隐渐显），通过 safeDrawing insets 避开刘海区域
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

            // 底部页面指示点，通过 safeDrawing insets 避开导航栏
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
                    // leaveTheme 由 DisposableEffect onDispose 统一执行，避免重复发送
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
