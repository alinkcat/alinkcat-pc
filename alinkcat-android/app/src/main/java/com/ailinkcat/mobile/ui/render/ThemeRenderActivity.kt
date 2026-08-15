package com.ailinkcat.mobile.ui.render

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
 * 主题包渲染页：全屏横屏展示主题包，支持页面滑动、控件交互与实时数据。
 */
class ThemeRenderActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val themeId = intent.getStringExtra(EXTRA_THEME_ID)
        if (themeId.isNullOrBlank()) {
            finish()
            return
        }

        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)
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

    companion object {
        const val EXTRA_THEME_ID = "theme_id"
    }
}
