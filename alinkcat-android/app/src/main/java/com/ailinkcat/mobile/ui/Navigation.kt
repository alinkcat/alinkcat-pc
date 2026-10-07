package com.ailinkcat.mobile.ui

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.ui.config.ConfigScreen
import com.ailinkcat.mobile.ui.config.SettingsScreen
import com.ailinkcat.mobile.ui.dialog.ReceiveConfirmDialog
import com.ailinkcat.mobile.ui.dialog.ReceiveProgressDialog
import com.ailinkcat.mobile.ui.main.MainScreen
import com.ailinkcat.mobile.ui.onboarding.OnboardingScreen
import com.ailinkcat.mobile.ui.profile.ProfileScreen
import com.ailinkcat.mobile.ui.render.ThemeRenderActivity
import com.ailinkcat.mobile.ui.scanner.ScannerScreen
import com.ailinkcat.mobile.ui.splash.SplashScreen
import com.ailinkcat.mobile.ui.themeList.ThemeListScreen
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel
import com.ailinkcat.mobile.viewmodel.PushReceiveViewModel
import com.ailinkcat.mobile.websocket.models.ReceiveStatus

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val MAIN = "main"
    const val SCANNER = "scanner"
    const val SETTINGS = "settings"
}

private const val ONBOARDING_KEY = "onboarding_done"
private const val WEATHER_KEY_PROMPTED = "weather_key_prompted"
private const val PRIVACY_CONSENT_KEY = "privacy_consent_v1"

/**
 * App nav graph: splash -> main, no login. Everything works locally; weather
 * and other cloud data go through the weather API key. Prompts once on first
 * launch when no key is set. Also hosts the theme push dialogs and snackbar.
 */
@Composable
fun AlinkcatApp(connectionViewModel: ConnectionViewModel) {
    val navController = rememberNavController()
    val context = LocalContext.current
    val sharedPrefs = remember { context.applicationContext.getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE) }

    // language switch recreates the host activity so attachBaseContext re-applies the locale
    val langManager = remember { com.ailinkcat.mobile.i18n.LanguageManager.get(context) }
    val recreateTick by langManager.recreateTick.collectAsStateWithLifecycle()
    val activity = context as? android.app.Activity
    LaunchedEffect(recreateTick) {
        if (recreateTick > 0 && activity != null) activity.recreate()
    }

    var onboardingDone by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        onboardingDone = sharedPrefs.getBoolean(ONBOARDING_KEY, false)
    }

    var showWeatherKeyPrompt by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val alreadyPrompted = sharedPrefs.getBoolean(WEATHER_KEY_PROMPTED, false)
        val hasKey = !sharedPrefs.getString("weather_api_key", "").isNullOrBlank()
        if (!alreadyPrompted && !hasKey) showWeatherKeyPrompt = true
    }
    fun dismissWeatherKeyPrompt() {
        showWeatherKeyPrompt = false
        sharedPrefs.edit().putBoolean(WEATHER_KEY_PROMPTED, true).apply()
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
        // remote theme switch from the PC side
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
                        val dest = if (!onboardingDone) Routes.ONBOARDING else Routes.MAIN
                        navController.navigate(dest) {
                            popUpTo(Routes.SPLASH) { inclusive = true }
                        }
                    }
                )
            }
            composable(Routes.ONBOARDING) {
                OnboardingScreen(
                    onFinished = {
                        sharedPrefs.edit()
                            .putBoolean(ONBOARDING_KEY, true)
                            .putBoolean(PRIVACY_CONSENT_KEY, true)
                            .apply()
                        navController.navigate(Routes.MAIN) {
                            popUpTo(Routes.ONBOARDING) { inclusive = true }
                        }
                    }
                )
            }
            composable(Routes.MAIN) {
                MainScreen(
                    viewModel = connectionViewModel,
                    onOpenScanner = { navController.navigate(Routes.SCANNER) },
                    onOpenSettings = { navController.navigate(Routes.SETTINGS) }
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
            composable(Routes.SETTINGS) {
                SettingsScreen(
                    viewModel = connectionViewModel,
                    onBack = { navController.popBackStack() }
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

    if (showWeatherKeyPrompt) {
        AlertDialog(
            onDismissRequest = { dismissWeatherKeyPrompt() },
            title = { Text(stringResource(R.string.weather_key_prompt_title)) },
            text = {
                Column {
                    Text(stringResource(R.string.weather_key_prompt_text))
                    Spacer(Modifier.height(4.dp))
                    Text(stringResource(R.string.weather_key_prompt_secondary), style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        dismissWeatherKeyPrompt()
                        navController.navigate(Routes.SETTINGS)
                    }
                ) { Text(stringResource(R.string.weather_key_prompt_go_settings)) }
            },
            dismissButton = {
                TextButton(onClick = { dismissWeatherKeyPrompt() }) { Text(stringResource(R.string.weather_key_prompt_later)) }
            }
        )
    }
}
