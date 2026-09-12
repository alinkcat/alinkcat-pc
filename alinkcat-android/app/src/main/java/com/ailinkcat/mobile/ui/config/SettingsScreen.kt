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
 * 独立设置页：iOS 分组设置风格。
 * 顶部导航栏显示「设置」+ 返回，主体为分组列表（设备 / 天气 / 危险操作 / 关于）。
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

    // 天气 API Key（存 SharedPreferences）
    val prefs = context.applicationContext.getSharedPreferences("ilinkcat_prefs", Context.MODE_PRIVATE)
    var weatherKey by remember { mutableStateOf(prefs.getString("weather_api_key", "") ?: "") }
    val weatherKeyDisplay = if (weatherKey.length > 10) weatherKey.take(10) + "****"
        else if (weatherKey.isNotEmpty()) weatherKey.take(3) + "****"
        else ""

    val refreshValue = if (config.weatherRefreshSeconds > 0) {
        "${config.weatherRefreshSeconds / 60} 分钟"
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

            // 设备
            SettingsGroup(title = "设备") {
                SettingsRow(
                    label = stringResource(R.string.device_name_label),
                    value = config.deviceName,
                    showDivider = false,
                    onClick = { showDeviceNameDialog = true }
                )
            }

            // 天气
            SettingsGroup(title = "天气") {
                SettingsRow(
                    label = "天气 API Key",
                    value = weatherKeyDisplay,
                    placeholder = "未设置",
                    onClick = { showWeatherKeyDialog = true }
                )
                SettingsRow(
                    label = "天气刷新频率",
                    value = refreshValue,
                    placeholder = "跟随主题",
                    onClick = { showRefreshDialog = true }
                )
                SettingsRow(
                    label = "定位失败兜底城市",
                    value = config.fallbackCity,
                    placeholder = "跟随主题",
                    showDivider = false,
                    onClick = { showCityDialog = true }
                )
            }

            // 危险操作
            SettingsGroup(title = "") {
                SettingsDangerRow(
                    text = stringResource(R.string.clear_pairing_info),
                    onClick = { showClearConfirm = true }
                )
            }

            // 关于
            SettingsGroup(title = "关于") {
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
            placeholder = "My Android",
            onDismiss = { showDeviceNameDialog = false },
            onConfirm = {
                viewModel.renameDevice(it.ifBlank { "My Android" })
                toastSaved()
            }
        )
    }

    if (showRefreshDialog) {
        SettingsEditDialog(
            title = "天气刷新频率（分钟）",
            initialValue = if (config.weatherRefreshSeconds > 0) {
                (config.weatherRefreshSeconds / 60).toString()
            } else "".trim(),
            placeholder = "留空 = 跟随主题默认",
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
            text = { Text("确定要清除当前设备的配对信息吗？此操作不可撤销。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.clearPairingInfo()
                        showClearConfirm = false
                    }
                ) { Text("清除", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirm = false }) { Text("取消") }
            }
        )
    }
}

/**
 * iOS 分组：小灰标题 + 圆角卡片（组内行由 [SettingsRow]/[SettingsDangerRow] 组成）。
 */
@Composable
private fun SettingsGroup(
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
 * 标准设置行：左侧标签，右侧当前值（灰色）+ chevron。
 * [placeholder] 在值为空时显示（如「跟随主题」），并以更淡的灰色呈现。
 */
@Composable
private fun SettingsRow(
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

/**
 * 危险操作行：整行居中红色文字（iOS 红色操作风格）。
 */
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

/**
 * 编辑单个字符串/数字的弹窗：用于修改设备名、刷新频率、兜底城市。
 */
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
            TextButton(onClick = onDismiss) { Text("取消") }
        }
    )
}

/**
 * 城市选择弹窗：顶部搜索框 + 可滚动城市列表（数据来自 [CityOptions]），防止误输入。
 * 点击城市即选中；「清空」表示恢复跟随主题默认城市。
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
        title = { Text("选择兜底城市") },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("搜索城市，如 北京 / 上海") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                if (filtered.isEmpty()) {
                    Text(
                        text = "未找到匹配的城市",
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
                Text("清空", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("取消") }
        }
    )
}

/**
 * 天气 API Key 编辑弹窗：从 PC 端会员中心复制粘贴，支持清空。
 */
@Composable
private fun WeatherKeyDialog(
    initialValue: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var text by remember { mutableStateOf(initialValue) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("天气 API Key") },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "在 PC 端「会员中心 → 天气服务」申请后复制粘贴到这里。Key 仅展示一次，请妥善保存。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it.trim() },
                    placeholder = { Text("ALM-xxxxxxxxxxxxxxxxxxxxxxxx") },
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
            TextButton(onClick = onDismiss) { Text("取消") }
        }
    )
}
