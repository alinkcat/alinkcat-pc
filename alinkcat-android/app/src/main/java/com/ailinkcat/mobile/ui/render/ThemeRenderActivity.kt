package com.ailinkcat.mobile.ui.render

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ailinkcat.mobile.ui.theme.AlinkcatTheme

/**
 * 主题包渲染页：支持横竖屏切换的全屏沉浸式渲染。
 * - 边缘到边渲染，内容延伸到刘海/挖孔区域
 * - `setDecorFitsSystemWindows(false)` 让内容绘制到系统栏与刘海区域，
 *   再由 ThemeRenderScreen 中的 WindowInsets 安全区域保证主题内容不被遮挡
 * - 横竖屏切换通过 manifest 中 configChanges 阻止 Activity 重建，保持主题页不变
 */
class ThemeRenderActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val themeId = intent.getStringExtra(EXTRA_THEME_ID)
        if (themeId.isNullOrBlank()) {
            finish()
            return
        }

        // 启用边缘到边渲染 + 显式设置 setDecorFitsSystemWindows(false)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        enableEdgeToEdge()

        // 进入沉浸模式：隐藏系统栏，上滑短暂显示
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        setContent {
            AlinkcatTheme {
                val viewModel: ThemeRenderViewModel =
                    viewModel(factory = ThemeRenderViewModel.factory(themeId))
                ThemeRenderScreen(
                    viewModel = viewModel,
                    onExit = { finish() }
                )
            }
        }
    }

    /**
     * 横竖屏切换时：
     * - Activity 因 manifest configChanges 不会重建，ViewModel 状态自然保留
     * - Compose 的 BoxWithConstraints 自动感知尺寸变化并重组，重新计算布局
     * - 系统栏在旋转后可能重新显示，此处再次隐藏以维持沉浸模式
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    companion object {
        const val EXTRA_THEME_ID = "theme_id"
    }
}
