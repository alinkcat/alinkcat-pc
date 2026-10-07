package com.ailinkcat.mobile.ui.render

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ailinkcat.mobile.i18n.LanguageManager
import com.ailinkcat.mobile.ui.theme.AlinkcatTheme

/**
 * Full-screen immersive theme render page. Locks orientation from the theme's
 * orientation field (landscape default); configChanges in the manifest keeps
 * the activity alive across rotation so the rendered page is never torn down.
 */
class ThemeRenderActivity : ComponentActivity() {

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(LanguageManager.get(newBase).attachBaseContext(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val themeId = intent.getStringExtra(EXTRA_THEME_ID)
        if (themeId.isNullOrBlank()) {
            finish()
            return
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        enableEdgeToEdge()

        // it's a display page, keep the screen on
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        setContent {
            AlinkcatTheme {
                val viewModel: ThemeRenderViewModel =
                    viewModel(factory = ThemeRenderViewModel.factory(themeId))
                val uiState by viewModel.uiState.collectAsState()

                LaunchedEffect(uiState.theme?.orientation) {
                    val orientation = uiState.theme?.orientation ?: "landscape"
                    requestedOrientation = when (orientation) {
                        "portrait" -> android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                        else -> android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    }
                }

                ThemeRenderScreen(
                    viewModel = viewModel,
                    onExit = { finish() }
                )
            }
        }
    }

    /**
     * Rotation doesn't recreate the activity (manifest configChanges); the
     * system bars may reappear, so hide them again to stay immersive.
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
