package com.ailinkcat.mobile.i18n

import android.content.Context
import android.net.Uri
import com.ailinkcat.mobile.R
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

/** language settings screen state */
sealed class LanguageUiState {
    object Idle : LanguageUiState()

    /** validation passed, waiting for the user to confirm; [jsonText] is the raw pack text written at install */
    data class ConfirmInstall(
        val fileName: String,
        val validation: PackValidation.Valid,
        val jsonText: String
    ) : LanguageUiState()

    object Busy : LanguageUiState()

    /** [message] feeds a Toast/Snackbar */
    data class Done(val message: String) : LanguageUiState()

    /** [reason] is user-readable */
    data class Failed(val reason: String) : LanguageUiState()
}

/** language settings viewmodel: selection, pack import (SAF/url), export, delete */
class LanguageViewModel private constructor(
    context: Context,
    private val manager: LanguageManager
) : ViewModel() {

    private val appContext = context.applicationContext

    companion object {
        fun factory(context: Context, manager: LanguageManager): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return LanguageViewModel(context.applicationContext, manager) as T
                }
            }

        private const val MAX_DOWNLOAD_BYTES = 2L * 1024 * 1024
        private const val MAX_REDIRECTS = 3
    }

    private val _state = MutableStateFlow<LanguageUiState>(LanguageUiState.Idle)
    val state: StateFlow<LanguageUiState> = _state.asStateFlow()

    private val _options = MutableStateFlow<List<LanguageOption>>(emptyList())
    val options: StateFlow<List<LanguageOption>> = _options.asStateFlow()

    private val _current = MutableStateFlow<LanguageSelection?>(null)
    val current: StateFlow<LanguageSelection?> = _current.asStateFlow()

    private val _installed = MutableStateFlow<List<InstalledPack>>(emptyList())
    val installed: StateFlow<List<InstalledPack>> = _installed.asStateFlow()

    /** bumped on language switch, activities recreate on it */
    private val _recreateTick = MutableStateFlow(0)
    val recreateTick: StateFlow<Int> = _recreateTick.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _options.value = manager.languageOptions()
            _current.value = manager.currentSelection.value
            _installed.value = manager.installedPacks()
        }
    }

    fun select(selection: LanguageSelection) {
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            try {
                manager.select(selection)
                _recreateTick.value += 1
                _state.value = LanguageUiState.Idle
                refresh()
            } catch (e: Exception) {
                _state.value = LanguageUiState.Failed(e.message ?: "switch failed")
            }
        }
    }

    /** shared entry after a SAF pick or a finished url download */
    fun validateAndStage(text: String, fileName: String) {
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            _state.value = when (val v = manager.validate(text)) {
                is PackValidation.Valid -> LanguageUiState.ConfirmInstall(fileName, v, text)
                is PackValidation.Invalid -> LanguageUiState.Failed(rejectMessage(v.reason))
            }
        }
    }

    /** the install button on the coverage dialog */
    fun confirmInstall() {
        val pending = _state.value as? LanguageUiState.ConfirmInstall ?: return
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            try {
                manager.install(pending.validation.pack, pending.jsonText)
                _state.value = LanguageUiState.Done(appContext.getString(R.string.lang_installed))
                refresh()
            } catch (e: Exception) {
                _state.value = LanguageUiState.Failed(e.message ?: "install failed")
            }
        }
    }

    /** SAF import: read the Uri and validate */
    fun importFromUri(context: Context, uri: Uri) {
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            try {
                val (text, name) = withContext(Dispatchers.IO) {
                    // same 2MB cap as the url channel (protocol rule 2): reading a
                    // huge file into a String would OOM long before validation
                    val size = context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }
                        ?: throw IllegalStateException("cannot read file")
                    if (size > MAX_DOWNLOAD_BYTES) {
                        throw IllegalArgumentException("file_too_large")
                    }
                    val text = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                        ?: throw IllegalStateException("cannot read file")
                    val name = uri.lastPathSegment?.substringAfterLast('/') ?: "pack.json"
                    text to name
                }
                validateAndStage(text, name)
            } catch (e: IllegalArgumentException) {
                _state.value = LanguageUiState.Failed(appContext.getString(R.string.pack_file_too_large))
            } catch (e: Exception) {
                _state.value = LanguageUiState.Failed(e.message ?: "read failed")
            }
        }
    }

    /** url download import: checks Content-Length, stages via a temp file */
    fun importFromUrl(url: String) {
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            try {
                val (text, name) = withContext(Dispatchers.IO) {
                    downloadPack(url)
                }
                validateAndStage(text, name)
            } catch (e: Exception) {
                _state.value = LanguageUiState.Failed(downloadErrorMessage(e))
            }
        }
    }

    private fun downloadPack(url: String): Pair<String, String> {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw IllegalArgumentException("invalid url")
        }
        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(false)
            .followSslRedirects(false)
            .build()
        var requestUrl = url
        var redirects = 0
        while (true) {
            val response = client.newCall(Request.Builder().url(requestUrl).build()).execute()
            response.use { resp ->
                if (resp.isRedirect) {
                    if (++redirects > MAX_REDIRECTS) throw IllegalStateException("too many redirects")
                    resp.header("Location")?.let { requestUrl = it } ?: throw IllegalStateException("redirect without location")
                    return@use
                }
                if (!resp.isSuccessful) throw IllegalStateException("http ${resp.code}")
                val declared = resp.body?.contentLength() ?: -1L
                if (declared > MAX_DOWNLOAD_BYTES) throw IllegalStateException("file too large")
                val body = resp.body?.byteStream() ?: throw IllegalStateException("empty body")
                val temp = File.createTempFile("langpack", ".json")
                var total = 0L
                body.use { input ->
                    temp.outputStream().use { out ->
                        val buf = ByteArray(16 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            total += n
                            if (total > MAX_DOWNLOAD_BYTES) {
                                temp.delete()
                                throw IllegalStateException("file too large")
                            }
                            out.write(buf, 0, n)
                        }
                    }
                }
                val text = temp.readText()
                temp.delete()
                return text to (requestUrl.substringAfterLast('/').ifBlank { "pack.json" })
            }
        }
        @Suppress("UNREACHABLE_CODE")
        throw IllegalStateException("unreachable")
    }

    /** english template or raw pack text, UI writes it to the SAF target */
    fun exportText(code: String?, onReady: (String?) -> Unit) {
        viewModelScope.launch {
            val text = if (code == null) manager.exportTemplate() else manager.exportPackText(code)
            onReady(text)
        }
    }

    fun deletePack(code: String) {
        viewModelScope.launch {
            _state.value = LanguageUiState.Busy
            try {
                manager.deletePack(code)
                _state.value = LanguageUiState.Done(appContext.getString(R.string.lang_deleted))
                _recreateTick.value += 1
                refresh()
            } catch (e: Exception) {
                _state.value = LanguageUiState.Failed(e.message ?: "delete failed")
            }
        }
    }

    fun consumeState() {
        if (_state.value is LanguageUiState.Done || _state.value is LanguageUiState.Failed) {
            _state.value = LanguageUiState.Idle
        }
    }

    private fun rejectMessage(reason: RejectReason): String = when (reason) {
        RejectReason.MALFORMED_JSON -> appContext.getString(R.string.pack_invalid_json)
        RejectReason.MISSING_FIELD -> appContext.getString(R.string.pack_missing_field)
        RejectReason.WRONG_PLATFORM -> appContext.getString(R.string.pack_wrong_platform)
        RejectReason.UNSUPPORTED_VERSION -> appContext.getString(R.string.pack_version_unsupported)
        RejectReason.TOO_MANY_KEYS -> appContext.getString(R.string.pack_too_many_keys)
        RejectReason.VALUE_TOO_LONG -> appContext.getString(R.string.pack_value_too_long)
        RejectReason.INVALID_CODE -> appContext.getString(R.string.pack_invalid_code)
    }

    private fun downloadErrorMessage(e: Exception): String = when {
        e is IllegalArgumentException -> appContext.getString(R.string.pack_invalid_url)
        e.message?.contains("too large") == true -> appContext.getString(R.string.pack_file_too_large)
        e.message?.startsWith("http ") == true -> appContext.getString(R.string.pack_download_failed_http, e.message)
        else -> appContext.getString(R.string.pack_network_error)
    }
}
