package com.ailinkcat.mobile.ui

import android.content.Intent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ailinkcat.mobile.data.TokenManager
import com.ailinkcat.mobile.ui.config.ConfigScreen
import com.ailinkcat.mobile.ui.dialog.ReceiveConfirmDialog
import com.ailinkcat.mobile.ui.dialog.ReceiveProgressDialog
import com.ailinkcat.mobile.ui.login.LoginScreen
import com.ailinkcat.mobile.ui.main.MainScreen
import com.ailinkcat.mobile.ui.profile.ProfileScreen
import com.ailinkcat.mobile.ui.render.ThemeRenderActivity
import com.ailinkcat.mobile.ui.scanner.ScannerScreen
import com.ailinkcat.mobile.ui.splash.SplashScreen
import com.ailinkcat.mobile.ui.themeList.ThemeListScreen
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import com.ailinkcat.mobile.viewmodel.PushReceiveViewModel
import com.ailinkcat.mobile.websocket.models.ReceiveStatus
import kotlinx.coroutines.flow.first

object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val MAIN = "main"
    const val SCANNER = "scanner"
}

/**
 * 应用导航图：启动页 -> (登录页 | 主界面) -> 扫码页。
 * 启动时读取本地登录状态：已登录直接进主界面，未登录进登录页。
 * 同时挂载主题包推送进度对话框与 Snackbar 提示。
 */
@Composable
fun AlinkcatApp(connectionViewModel: ConnectionViewModel) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val tokenManager = remember { TokenManager(context.applicationContext) }

    // 启动时读取本地登录状态（已登录则跳过登录页）
    var isLoggedIn by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        isLoggedIn = tokenManager.isLoggedIn.first()
    }

    val pushViewModel: PushReceiveViewModel = viewModel(
        factory = PushReceiveViewModel.factory(
            manager = connectionViewModel.pushReceiveManager,
            onPushCompleted = { connectionViewModel.refreshThemePackages() }
        )
    )

    val snackbarHostState = remember { SnackbarHostState() }
    val snackbarMessage by pushViewModel.snackbarMessage.collectAsStateWithLifecycle()

    LaunchedEffect(snackbarMessage) {
        snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            pushViewModel.consumeSnackbar()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // PC 端远程切换主题
        LaunchedEffect(Unit) {
            connectionViewModel.themeSwitchEvent.collect { themeId ->
                context.startActivity(
                    Intent(context, ThemeRenderActivity::class.java)
                        .putExtra(ThemeRenderActivity.EXTRA_THEME_ID, themeId)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
        }

        NavHost(
            navController = navController,
            startDestination = Routes.SPLASH
        ) {
            composable(Routes.SPLASH) {
                SplashScreen(
                    onFinished = {
                        // 已登录 -> 主界面；未登录 -> 登录页
                        navController.navigate(if (isLoggedIn) Routes.MAIN else Routes.LOGIN) {
                            popUpTo(Routes.SPLASH) { inclusive = true }
                        }
                    }
                )
            }
            composable(Routes.LOGIN) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Routes.MAIN) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    }
                )
            }
            composable(Routes.MAIN) {
                MainScreen(
                    viewModel = connectionViewModel,
                    onOpenScanner = { navController.navigate(Routes.SCANNER) }
                )
            }
            composable(Routes.SCANNER) {
                ScannerScreen(
                    onResult = { content ->
                        connectionViewModel.submitScanResult(content)
                        navController.popBackStack()
                    },
                    onCancel = { navController.popBackStack() }
                )
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )

        val receiveState by pushViewModel.state.collectAsStateWithLifecycle()
        val dialogVisible by pushViewModel.dialogVisible.collectAsStateWithLifecycle()
        val currentReceiveState = receiveState
        if (dialogVisible && currentReceiveState != null) {
            if (currentReceiveState.status == ReceiveStatus.PENDING_CONFIRM) {
                // 询问用户是否接收
                ReceiveConfirmDialog(
                    state = currentReceiveState,
                    onAccept = { pushViewModel.acceptReceive() },
                    onReject = { pushViewModel.rejectReceive() }
                )
            } else {
                ReceiveProgressDialog(
                    state = currentReceiveState,
                    onCancel = { pushViewModel.cancelReceive() },
                    onClose = { pushViewModel.dismiss() }
                )
            }
        }
    }
}
