package com.ailinkcat.mobile.ui.config

import android.Manifest
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.i18n.LanguageOption
import com.ailinkcat.mobile.i18n.LanguageSelection
import com.ailinkcat.mobile.i18n.LanguageUiState
import com.ailinkcat.mobile.i18n.LanguageViewModel
import com.ailinkcat.mobile.i18n.PackValidation

/**
 * Language settings section: picker, import (file/url), export, installed packs.
 * Switching recreates the activity via recreateTick so it applies immediately.
 */
@Composable
fun LanguageSettingsSection() {
    val context = LocalContext.current
    val vm: LanguageViewModel = viewModel(factory = LanguageViewModel.factory(
        context.applicationContext,
        com.ailinkcat.mobile.i18n.LanguageManager.get(context)
    ))
    val options by vm.options.collectAsStateWithLifecycle()
    val current by vm.current.collectAsStateWithLifecycle()
    val state by vm.state.collectAsStateWithLifecycle()

    var showPicker by remember { mutableStateOf(false) }
    var showUrlDialog by remember { mutableStateOf(false) }
    var showManage by remember { mutableStateOf(false) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) vm.importFromUri(context, uri)
    }

    // SAF export (write target)
    var exportRequest by remember { mutableStateOf<String?>(null) } // null = template, otherwise pack code
    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        val requestCode = exportRequest
        if (uri != null && requestCode != null) {
            vm.exportText(
                if (requestCode == "template") null else requestCode,
                onReady = { text ->
                    if (text != null) {
                        try {
                            context.contentResolver.openOutputStream(uri)?.use { out ->
                                out.write(text.toByteArray(Charsets.UTF_8))
                            }
                            Toast.makeText(context, "Exported", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(context, "Export failed", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            )
        }
        exportRequest = null
    }

    LaunchedEffect(state) {
        when (val s = state) {
            is LanguageUiState.Done -> {
                Toast.makeText(context, s.message, Toast.LENGTH_SHORT).show()
                vm.consumeState()
            }
            is LanguageUiState.Failed -> {
                Toast.makeText(context, s.reason, Toast.LENGTH_SHORT).show()
                vm.consumeState()
            }
            else -> Unit
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        SettingsGroup(title = stringResource(R.string.lang_group_title)) {
            SettingsRow(
                label = stringResource(R.string.lang_current),
                value = currentLabel(current, options),
                showDivider = true,
                onClick = { vm.refresh(); showPicker = true }
            )
            SettingsRow(
                label = stringResource(R.string.lang_import_pack),
                showDivider = true,
                onClick = { importLauncher.launch(arrayOf("application/json")) }
            )
            SettingsRow(
                label = stringResource(R.string.lang_download_url),
                showDivider = true,
                onClick = { showUrlDialog = true }
            )
            SettingsRow(
                label = stringResource(R.string.lang_export_template),
                showDivider = true,
                onClick = {
                    exportRequest = "template"
                    exportLauncher.launch("ilinkcat_lang_template.json")
                }
            )
            SettingsRow(
                label = stringResource(R.string.lang_manage_packs),
                showDivider = false,
                onClick = { vm.refresh(); showManage = true }
            )
        }
    }

    if (showPicker) {
        LanguagePickerDialog(
            options = options,
            current = current,
            onSelect = { vm.select(it); showPicker = false },
            onDismiss = { showPicker = false }
        )
    }

    if (showUrlDialog) {
        UrlDownloadDialog(
            onConfirm = { url -> vm.importFromUrl(url); showUrlDialog = false },
            onDismiss = { showUrlDialog = false }
        )
    }

    if (showManage) {
        ManagePacksDialog(
            vm = vm,
            onDismiss = { showManage = false }
        )
    }

    val confirmState = state as? LanguageUiState.ConfirmInstall
    if (confirmState != null) {
        InstallConfirmDialog(
            state = confirmState,
            onConfirm = { vm.confirmInstall() },
            onDismiss = { vm.consumeState() }
        )
    }

    // busy state: no global overlay, buttons give feedback inline
    if (state is LanguageUiState.Busy) {
    }
}

@Composable
private fun currentLabel(current: LanguageSelection?, options: List<LanguageOption>): String {
    val opt = options.firstOrNull { it.selection == current }
    return when {
        current == null -> "English"
        current is LanguageSelection.SystemDefault -> "System Default"
        opt != null -> opt.label
        current is LanguageSelection.Native -> current.code
        current is LanguageSelection.Dynamic -> current.code
        else -> ""
    }
}

@Composable
private fun LanguagePickerDialog(
    options: List<LanguageOption>,
    current: LanguageSelection?,
    onSelect: (LanguageSelection) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.lang_current)) },
        text = {
            LazyColumn(modifier = Modifier.heightIn(max = 400.dp)) {
                items(options, key = { it.label + it.builtin + it.imported }) { opt ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelect(opt.selection) }
                            .padding(horizontal = 4.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = opt.label,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f)
                        )
                        if (opt.builtin) {
                            Badge("Built-in")
                            Spacer(Modifier.height(0.dp))
                        }
                        if (opt.imported) {
                            Badge("Imported")
                        }
                        if (opt.selection == current) {
                            Text(
                                text = "✓",
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(start = 8.dp)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
        }
    )
}

@Composable
private fun Badge(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .padding(start = 6.dp)
            .clickable(enabled = false) {}
    )
}

@Composable
private fun UrlDownloadDialog(
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var url by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.lang_download_url)) },
        text = {
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                placeholder = { Text("https://example.com/langpacks/ja-JP.json") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (url.isNotBlank()) onConfirm(url.trim()) }
            ) { Text(stringResource(R.string.lang_download)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}

@Composable
private fun ManagePacksDialog(
    vm: LanguageViewModel,
    onDismiss: () -> Unit
) {
    val installed by vm.installed.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var exportCode by remember { mutableStateOf<String?>(null) }
    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        val code = exportCode
        if (uri != null && code != null) {
            vm.exportText(code) { text ->
                if (text != null) {
                    try {
                        context.contentResolver.openOutputStream(uri)?.use { out ->
                            out.write(text.toByteArray(Charsets.UTF_8))
                        }
                        Toast.makeText(context, "Exported", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(context, "Export failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        exportCode = null
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.lang_manage_packs)) },
        text = {
            if (installed.isEmpty()) {
                Text(
                    text = stringResource(R.string.lang_no_packs),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn(modifier = Modifier.heightIn(max = 360.dp)) {
                    items(installed, key = { it.code }) { pack ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(pack.label, style = MaterialTheme.typography.bodyLarge)
                                Text(
                                    text = "${pack.code} · ${pack.keyCount} keys",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            TextButton(onClick = {
                                exportCode = pack.code
                                exportLauncher.launch("${pack.code}.json")
                            }) { Text(stringResource(R.string.lang_export)) }
                            TextButton(onClick = { vm.deletePack(pack.code) }) {
                                Text(
                                    stringResource(R.string.delete),
                                    color = MaterialTheme.colorScheme.error
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
        }
    )
}

@Composable
private fun InstallConfirmDialog(
    state: LanguageUiState.ConfirmInstall,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val v = state.validation
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.lang_install_confirm_title)) },
        text = {
            Column {
                Text(
                    text = stringResource(
                        R.string.lang_install_coverage,
                        v.translatedKeys,
                        v.totalKeys
                    ),
                    style = MaterialTheme.typography.bodyMedium
                )
                if (v.placeholderMismatches.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(
                            R.string.lang_install_mismatch,
                            v.placeholderMismatches.size
                        ) + " " + v.placeholderMismatches.take(3).joinToString(", "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (v.unknownKeys.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.lang_install_unknown, v.unknownKeys.size),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.lang_install_fallback_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text(stringResource(R.string.accept)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        }
    )
}
