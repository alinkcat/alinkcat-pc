package com.ailinkcat.mobile.ui.config

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.ui.viewmodel.ConnectionViewModel

/**
 * Standalone settings screen, iOS grouped style:
 * device / language / weather / danger zone / about.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: ConnectionViewModel,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val config by viewModel.savedConfig.collectAsStateWithLifecycle()
    val uriHandler = LocalUriHandler.current
    val privacyPolicyUrl = stringResource(R.string.privacy_policy_url)

    var showDeviceNameDialog by remember { mutableStateOf(false) }
    var showRefreshDialog by remember { mutableStateOf(false) }
    var showCityDialog by remember { mutableStateOf(false) }
    var showWeatherKeyDialog by remember { mutableStateOf(false) }
    var showClearConfirm by remember { mutableStateOf(false) }

    val prefs = context.applicationContext.getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
    var weatherKey by remember { mutableStateOf(prefs.getString("weather_api_key", "") ?: "") }
    val weatherKeyDisplay = if (weatherKey.length > 10) weatherKey.take(10) + "****"
        else if (weatherKey.isNotEmpty()) weatherKey.take(3) + "****"
        else ""

    val refreshValue = if (config.weatherRefreshSeconds > 0) {
        stringResource(R.string.weather_refresh_minutes_fmt, config.weatherRefreshSeconds / 60)
    } else ""

    val toastSaved = { Toast.makeText(context, context.getString(R.string.saved), Toast.LENGTH_SHORT).show() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.settings_title), fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text(
                            text = "‹",
                            fontSize = 34.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Spacer(Modifier.height(4.dp))

            SettingsGroup(title = stringResource(R.string.group_device)) {
                SettingsRow(
                    label = stringResource(R.string.device_name_label),
                    value = config.deviceName,
                    showDivider = false,
                    onClick = { showDeviceNameDialog = true }
                )
            }

            LanguageSettingsSection()

            SettingsGroup(title = stringResource(R.string.group_weather)) {
                SettingsRow(
                    label = stringResource(R.string.weather_api_key),
                    value = weatherKeyDisplay,
                    placeholder = stringResource(R.string.not_set),
                    onClick = { showWeatherKeyDialog = true }
                )
                SettingsRow(
                    label = stringResource(R.string.weather_refresh_rate),
                    value = refreshValue,
                    placeholder = stringResource(R.string.weather_follow_theme),
                    onClick = { showRefreshDialog = true }
                )
                SettingsRow(
                    label = stringResource(R.string.weather_fallback_city),
                    value = config.fallbackCity,
                    placeholder = stringResource(R.string.weather_follow_theme),
                    showDivider = false,
                    onClick = { showCityDialog = true }
                )
            }

            SettingsGroup(title = "") {
                SettingsDangerRow(
                    text = stringResource(R.string.clear_pairing_info),
                    onClick = { showClearConfirm = true }
                )
            }

            SettingsGroup(title = stringResource(R.string.group_about)) {
                SettingsRow(
                    label = stringResource(R.string.privacy_policy),
                    showDivider = false,
                    onClick = { uriHandler.openUri(privacyPolicyUrl) }
                )
            }

            Spacer(Modifier.height(20.dp))
        }
    }

    if (showDeviceNameDialog) {
        SettingsEditDialog(
            title = stringResource(R.string.device_name_label),
            initialValue = config.deviceName,
            placeholder = stringResource(R.string.default_device_name),
            onDismiss = { showDeviceNameDialog = false },
            onConfirm = {
                viewModel.renameDevice(it.ifBlank { context.getString(R.string.default_device_name) })
                toastSaved()
            }
        )
    }

    if (showRefreshDialog) {
        SettingsEditDialog(
            title = stringResource(R.string.weather_refresh_dialog_title),
            initialValue = if (config.weatherRefreshSeconds > 0) {
                (config.weatherRefreshSeconds / 60).toString()
            } else "".trim(),
            placeholder = stringResource(R.string.weather_refresh_dialog_hint),
            numberOnly = true,
            onDismiss = { showRefreshDialog = false },
            onConfirm = {
                val minutes = it.toIntOrNull() ?: 0
                viewModel.saveWeatherRefreshSeconds(if (minutes > 0) minutes * 60 else 0)
                toastSaved()
            }
        )
    }

    if (showCityDialog) {
        CityPickerDialog(
            current = config.fallbackCity,
            onSelect = { city ->
                viewModel.saveFallbackCity(city)
                toastSaved()
            },
            onClear = {
                viewModel.saveFallbackCity("")
                toastSaved()
            },
            onDismiss = { showCityDialog = false }
        )
    }

    if (showWeatherKeyDialog) {
        WeatherKeyDialog(
            initialValue = weatherKey,
            onDismiss = { showWeatherKeyDialog = false },
            onConfirm = { key ->
                weatherKey = key
                prefs.edit().putString("weather_api_key", key).apply()
                toastSaved()
            }
        )
    }

    if (showClearConfirm) {
        AlertDialog(
            onDismissRequest = { showClearConfirm = false },
            title = { Text(stringResource(R.string.clear_pairing_info)) },
            text = { Text(stringResource(R.string.clear_pairing_confirm_text)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.clearPairingInfo()
                        showClearConfirm = false
                    }
                ) { Text(stringResource(R.string.clear_confirm), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}

/** iOS-style group: small gray header + rounded card. */
@Composable
internal fun SettingsGroup(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        if (title.isNotEmpty()) {
            Text(
                text = title.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 6.dp)
            )
        }
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                content()
            }
        }
    }
}

/**
 * Standard settings row: label on the left, current value + chevron on the
 * right. [placeholder] shows in a fainter gray when the value is empty.
 */
@Composable
internal fun SettingsRow(
    label: String,
    value: String? = null,
    placeholder: String? = null,
    showDivider: Boolean = true,
    onClick: () -> Unit
) {
    val isPlaceholder = value.isNullOrBlank()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
        if (value != null || placeholder != null) {
            Text(
                text = if (isPlaceholder) placeholder ?: "" else value,
                style = MaterialTheme.typography.bodyMedium,
                color = if (isPlaceholder) {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(end = 8.dp)
            )
        }
        Text(
            text = "›",
            fontSize = 24.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
    }
    if (showDivider) {
        HorizontalDivider(
            modifier = Modifier.padding(start = 18.dp),
            thickness = 0.7.dp,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
        )
    }
}

/** danger row: centered red text, iOS destructive-action style. */
@Composable
private fun SettingsDangerRow(
    text: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center
        )
    }
}

/** dialog for editing a single string/number (device name, refresh rate, fallback city). */
@Composable
private fun SettingsEditDialog(
    title: String,
    initialValue: String,
    placeholder: String,
    numberOnly: Boolean = false,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var text by remember { mutableStateOf(initialValue) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { new ->
                    text = if (numberOnly) new.filter(Char::isDigit) else new
                },
                placeholder = { Text(placeholder) },
                singleLine = true,
                keyboardOptions = if (numberOnly) {
                    KeyboardOptions(keyboardType = KeyboardType.Number)
                } else {
                    KeyboardOptions.Default
                },
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(text.trim()); onDismiss() }) {
                Text(stringResource(R.string.save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

/**
 * City picker: search box + scrollable list from [CityOptions] so users can't
 * mistype. Tapping a city selects it; "clear" restores the theme default.
 */
@Composable
private fun CityPickerDialog(
    current: String,
    onSelect: (String) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(query) {
        val q = query.trim()
        if (q.isEmpty()) CityOptions.cities
        else CityOptions.cities.filter { it.contains(q) }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.city_picker_title)) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(stringResource(R.string.city_picker_search_hint)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                if (filtered.isEmpty()) {
                    Text(
                        text = stringResource(R.string.city_picker_no_match),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp)
                    )
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 340.dp)) {
                        items(filtered) { city ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onSelect(city)
                                        onDismiss()
                                    }
                                    .padding(horizontal = 8.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = city,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.weight(1f)
                                )
                                if (city == current.trim()) {
                                    Text(
                                        text = "✓",
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            HorizontalDivider(
                                modifier = Modifier.padding(start = 8.dp),
                                thickness = 0.7.dp,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.06f)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onClear(); onDismiss() }) {
                Text(stringResource(R.string.city_picker_clear), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

/** weather API key dialog; paste from the PC membership center, can also be cleared. */
@Composable
private fun WeatherKeyDialog(
    initialValue: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var text by remember { mutableStateOf(initialValue) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.weather_key_dialog_title)) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.weather_key_dialog_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it.trim() },
                    placeholder = { Text(stringResource(R.string.weather_key_placeholder)) },
                    singleLine = false,
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(text); onDismiss() }
            ) { Text(stringResource(R.string.save)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}
