package com.ailinkcat.mobile.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.ui.config.ConfigScreen
import com.ailinkcat.mobile.ui.macro.MacroScreen
import com.ailinkcat.mobile.ui.profile.ProfileScreen
import com.ailinkcat.mobile.ui.theme.ErrorRed
import com.ailinkcat.mobile.ui.theme.IdleGray
import com.ailinkcat.mobile.ui.theme.SuccessGreen
import com.ailinkcat.mobile.ui.theme.WarningOrange
import com.ailinkcat.mobile.ui.themeList.ThemeListScreen
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import androidx.compose.material3.MaterialTheme

enum class MainTab(val labelRes: Int, val emoji: String) {
    THEMES(R.string.tab_themes, "🏠"),
    MACRO(R.string.tab_macro, "⚡"),
    CONFIG(R.string.tab_config, "⚙️"),
    PROFILE(R.string.tab_profile, "👤")
}

/**
 * 主界面：Material 3 底部导航框架，承载主题包 / 配置 / 我的三个 Tab，
 * 顶部 App Bar 显示连接状态指示器。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: ConnectionViewModel,
    onOpenScanner: () -> Unit,
    onOpenSettings: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (selectedTab == 0) stringResource(R.string.app_title_themes)
                        else stringResource(MainTab.entries[selectedTab].labelRes)
                    )
                },
                actions = {
                    ConnectionStatusIndicator(status = state.status)
                }
            )
        },
        bottomBar = {
            NavigationBar {
                MainTab.entries.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        icon = { Text(tab.emoji, fontSize = 20.sp) },
                        label = { Text(stringResource(tab.labelRes)) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedTab) {
                0 -> ThemeListScreen(viewModel = viewModel)
                1 -> MacroScreen(viewModel = viewModel)
                2 -> ConfigScreen(
                    viewModel = viewModel,
                    onOpenScanner = onOpenScanner
                )
                3 -> ProfileScreen(
                    viewModel = viewModel,
                    onOpenThemes = { selectedTab = 0 },
                    onOpenSettings = onOpenSettings
                )
            }
        }
    }
}

/**
 * 连接状态指示器：已连接为绿色圆点，未连接为灰色圆点。
 */
@Composable
fun ConnectionStatusIndicator(status: ConnectionStatus) {
    Row(
        modifier = Modifier.padding(end = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(
                    color = when (status) {
                        ConnectionStatus.Connected -> SuccessGreen
                        ConnectionStatus.Connecting -> WarningOrange
                        ConnectionStatus.Error -> ErrorRed
                        else -> IdleGray
                    },
                    shape = CircleShape
                )
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = stringResource(
                when (status) {
                    ConnectionStatus.Connected -> R.string.connected
                    ConnectionStatus.Connecting -> R.string.connecting
                    ConnectionStatus.Error -> R.string.connection_failed
                    else -> R.string.disconnected
                }
            ),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
