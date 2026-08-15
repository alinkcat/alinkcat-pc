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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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

enum class MainTab(val label: String, val emoji: String) {
    THEMES("主题包", "🏠"),
    MACRO("宏与片段", "⚡"),
    CONFIG("配置", "⚙️"),
    PROFILE("我的", "👤")
}

/**
 * 主界面：Material 3 底部导航框架，承载主题包 / 配置 / 我的三个 Tab，
 * 顶部 App Bar 显示连接状态指示器。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: ConnectionViewModel,
    onOpenScanner: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (selectedTab == 0) "艾联猫 · 主题包"
                        else MainTab.entries[selectedTab].label
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
                        label = { Text(tab.label) }
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
                    onOpenThemes = { selectedTab = 0 }
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
            text = when (status) {
                ConnectionStatus.Connected -> "已连接"
                ConnectionStatus.Connecting -> "连接中"
                ConnectionStatus.Error -> "连接失败"
                else -> "未连接"
            },
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
