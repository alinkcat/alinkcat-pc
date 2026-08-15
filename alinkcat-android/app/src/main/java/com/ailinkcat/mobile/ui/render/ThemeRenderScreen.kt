package com.ailinkcat.mobile.ui.render

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.domain.models.Theme
import com.ailinkcat.mobile.ui.render.components.DotsIndicator
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.IdleGray
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import java.io.File

/**
 * 主题包渲染主页面：加载 / 错误 / 渲染三态 + 全屏横屏交互。
 */
@Composable
fun ThemeRenderScreen(
    viewModel: ThemeRenderViewModel,
    onExit: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // 进入主题包页面时激活订阅，离开时取消
    LaunchedEffect(Unit) {
        viewModel.enterTheme()
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
                text = message ?: "主题包加载失败",
                color = Color.White,
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(16.dp))
            Row {
                TextButton(onClick = onRetry) { Text("重试", color = Color.White) }
                TextButton(onClick = onExit) { Text("返回", color = Color.White) }
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

    LaunchedEffect(pagerState.currentPage) {
        viewModel.onPageChanged(pagerState.currentPage)
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
                    onButtonClick = { widgetId, action -> viewModel.executeAction(widgetId, action) },
                    onSnippetClick = { content -> viewModel.executeSnippet(content) }
                )
            }
        }

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

        // 透明唤醒条——仅顶部 40dp 区域监听点击，不干扰 HorizontalPager 滑动
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(top = 0.dp)
                .height(40.dp)
                .pointerInput(Unit) {
                    detectTapGestures { wakeControls() }
                }
        )

        // 顶部悬浮控件（渐隐渐显）
        AnimatedVisibility(
            visible = showControls || !isConnected,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.TopStart)
        ) {
            // 左上角退出按钮
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
            modifier = Modifier.align(Alignment.TopEnd)
        ) {
            // 右上角连接状态
            Row(
                modifier = Modifier
                    .padding(12.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.Black.copy(alpha = 0.35f))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val (dotColor, label) = when (uiState.connectionStatus) {
                    ConnectionStatus.Connected -> SuccessGreen to "已连接"
                    ConnectionStatus.Connecting -> WarningOrange to "连接中"
                    ConnectionStatus.Error -> ErrorRed to "连接失败"
                    else -> IdleGray to "未连接"
                }
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(dotColor)
                )
                Spacer(Modifier.width(6.dp))
                Text(label, color = Color.White, fontSize = 12.sp)
            }
        }

        // 底部页面指示点
        if (theme.pages.size > 1) {
            DotsIndicator(
                pageCount = theme.pages.size,
                currentPage = pagerState.currentPage,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 12.dp)
            )
        }
    }

    if (uiState.showExitConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::dismissExitConfirm,
            title = { Text("退出主题包") },
            text = { Text("确定要退出当前主题包展示吗？") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.leaveTheme()
                    viewModel.releaseConnection()
                    onExit()
                }) {
                    Text("退出")
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissExitConfirm) {
                    Text("取消")
                }
            }
        )
    }
}
