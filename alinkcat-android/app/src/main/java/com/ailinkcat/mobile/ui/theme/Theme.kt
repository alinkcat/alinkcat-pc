package com.ailinkcat.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColorScheme = lightColorScheme(
    primary = BrandBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3E9FF),
    onPrimaryContainer = Color(0xFF1F2E80),
    secondary = BrandPurple,
    onSecondary = Color.White,
    tertiary = Pink40,
    background = Color(0xFFF7F8FC),
    onBackground = Color(0xFF1C1B1F),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFEEF0F8),
    onSurfaceVariant = Color(0xFF646B7F),
    error = ErrorRed,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF8EA2FF),
    onPrimary = Color(0xFF102052),
    primaryContainer = Color(0xFF3347A8),
    onPrimaryContainer = Color(0xFFDDE4FF),
    secondary = Color(0xFF9F92F5),
    onSecondary = Color(0xFF1E1450),
    tertiary = Pink80,
    background = Color(0xFF101320),
    onBackground = Color(0xFFE6E1E5),
    surface = Color(0xFF171A2B),
    onSurface = Color(0xFFE6E1E5),
    surfaceVariant = Color(0xFF232742),
    onSurfaceVariant = Color(0xFFB8BED1),
    error = Color(0xFFFF6B6B),
    onError = Color(0xFF3B0909)
)

@Composable
fun AlinkcatTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,
        typography = Typography,
        content = content
    )
}
