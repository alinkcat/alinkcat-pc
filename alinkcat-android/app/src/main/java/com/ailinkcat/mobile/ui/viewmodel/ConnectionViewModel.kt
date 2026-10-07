package com.ailinkcat.mobile.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.DataStoreManager
import com.ailinkcat.mobile.data.model.ConnectionErrorType
import com.ailinkcat.mobile.data.model.ConnectionState
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.data.model.LauncherApp
import com.ailinkcat.mobile.data.model.SnippetItem
import com.ailinkcat.mobile.data.model.StoredConfig
import com.ailinkcat.mobile.data.model.ThemePackage
import com.ailinkcat.mobile.websocket.PushReceiveManager
import com.ailinkcat.mobile.websocket.WebSocketManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay

/** connection state: websocket + JSON-RPC handshake (pairing code), config persistence, theme package data. */
class ConnectionViewModel(application: Application) : AndroidViewModel(application) {

    // reported during handshake, kept in sync with versionName
    private val appVersion = com.ailinkcat.mobile.BuildConfig.VERSION_NAME

    private val dataStore = DataStoreManager(application)

    val savedConfig: StateFlow<StoredConfig> =
        dataStore.config.stateIn(viewModelScope, SharingStarted.Eagerly, StoredConfig())

    private val _state = MutableStateFlow(ConnectionState())
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _themePackages = MutableStateFlow<List<ThemePackage>>(emptyList())
    val themePackages: StateFlow<List<ThemePackage>> = _themePackages.asStateFlow()

    private val _pendingScanResult = MutableStateFlow<String?>(null)
    val pendingScanResult: StateFlow<String?> = _pendingScanResult.asStateFlow()

    /** remote theme.switch event from the PC; replay=1 so late collectors don't miss it */
    private val _themeSwitchEvent = MutableSharedFlow<String>(replay = 1)
    val themeSwitchEvent: SharedFlow<String> = _themeSwitchEvent.asSharedFlow()

    private val _launcherApps = MutableStateFlow<List<LauncherApp>>(emptyList())
    val launcherApps: StateFlow<List<LauncherApp>> = _launcherApps.asStateFlow()

    private val _snippetItems = MutableStateFlow<List<SnippetItem>>(emptyList())
    val snippetItems: StateFlow<List<SnippetItem>> = _snippetItems.asStateFlow()

    /** push receive manager; shares the websocket connection */
    val pushReceiveManager = PushReceiveManager(application)

    private val webSocket = WebSocketManager(
        context = application,
        listener = object : WebSocketManager.Listener {
            override fun onHandshakeSucceeded(
                deviceId: String?,
                serverVersion: String?,
                serverName: String?,
                themeList: List<String>
            ) {
                viewModelScope.launch {
                    isAutoConnecting = false
                    _state.value = ConnectionState(
                        status = ConnectionStatus.Connected,
                        deviceName = serverName,
                        serverVersion = serverVersion
                    )
                    populateThemePackages(themeList)
                }
            }

            override fun onConnectionClosed() {
                // clean up interrupted transfers on disconnect
                pushReceiveManager.handleConnectionLost()
                _state.value = ConnectionState(status = ConnectionStatus.Disconnected)
            }

            override fun onConnectionFailed(errorType: ConnectionErrorType, message: String) {
                pushReceiveManager.handleConnectionLost()
                _state.value = ConnectionState(
                    status = ConnectionStatus.Error,
                    errorType = errorType,
                    errorMessage = message
                )
                if (errorType == ConnectionErrorType.DUPLICATE_CONNECTION ||
                    errorType == ConnectionErrorType.DEVICE_LIMIT
                ) {
                    // kicked by a same-named device: don't auto-reconnect or the
                    // two ends keep kicking each other. device limit: retrying
                    // won't lift it either
                    isAutoConnecting = false
                } else {
                    onAutoConnectFailed()
                }
            }
        },
        pushHandler = pushReceiveManager,
        rawListener = { text -> handleMacroMessage(text) }
    )

    /** auto-connect retry state */
    private var autoRetryCount = 0
    private var isAutoConnecting = false

    private fun autoConnect() {
        isAutoConnecting = true
        autoRetryCount = 0
        viewModelScope.launch {
            val cfg = dataStore.config.first()
            if (cfg.ip.isNotBlank() && cfg.port.isNotBlank() && cfg.pairCode.isNotBlank()) {
                _state.value = ConnectionState(status = ConnectionStatus.Connecting)
                webSocket.connect("ws://${cfg.ip}:${cfg.port}", cfg.pairCode, cfg.deviceName, appVersion)
            }
        }
    }

    private fun onAutoConnectFailed() {
        if (!isAutoConnecting) return
        autoRetryCount++
        if (autoRetryCount < 3) {
            _state.value = ConnectionState(status = ConnectionStatus.Connecting)
            viewModelScope.launch {
                delay(2000)
                val cfg = dataStore.config.first()
                webSocket.connect("ws://${cfg.ip}:${cfg.port}", cfg.pairCode, cfg.deviceName, appVersion)
            }
        } else {
            isAutoConnecting = false
        }
    }

    init {
        // push accept/reject/busy responses go out over the websocket
        pushReceiveManager.setResponseSender { json -> webSocket.sendResponse(json) }
        webSocket.themeSwitchListener = { themeId ->
            viewModelScope.launch {
                if (pushReceiveManager.getInstalledThemes().any { it.themeId == themeId }) {
                    _themeSwitchEvent.tryEmit(themeId)
                } else {
                    refreshThemePackages()
                }
            }
        }
        autoConnect()
    }

    /** connect: validate, persist, then open ws://{ip}:{port} and handshake with the pairing code. */
    fun connect(ip: String, port: String, pairCode: String) {
        val app = getApplication<Application>()
        if (ip.isBlank()) {
            _state.value = ConnectionState(
                status = ConnectionStatus.Error,
                errorMessage = app.getString(R.string.enter_pc_ip)
            )
            return
        }
        if (port.isBlank()) {
            _state.value = ConnectionState(
                status = ConnectionStatus.Error,
                errorMessage = app.getString(R.string.enter_port)
            )
            return
        }
        if (pairCode.isBlank()) {
            _state.value = ConnectionState(
                status = ConnectionStatus.Error,
                errorMessage = app.getString(R.string.enter_pairing_code)
            )
            return
        }

        _state.value = ConnectionState(status = ConnectionStatus.Connecting)
        isAutoConnecting = false
        viewModelScope.launch {
            dataStore.saveConnection(ip, port, pairCode)
            dataStore.saveLastConnected(ip, port)
            val deviceName = savedConfig.value.deviceName
            webSocket.connect("ws://$ip:$port", pairCode, deviceName, appVersion)
        }
    }

    fun disconnect() {
        // in-flight transfers keep their .part marker as interrupted, waiting for resume
        pushReceiveManager.handleConnectionLost()
        webSocket.close()
        _state.value = ConnectionState(status = ConnectionStatus.Disconnected)
    }

    fun clearPairingInfo() {
        viewModelScope.launch {
            dataStore.clearPairingCode()
        }
    }

    fun renameDevice(name: String) {
        viewModelScope.launch {
            dataStore.saveDeviceName(name)
        }
    }

    /** save weather refresh interval (seconds); <=0 means follow the theme default */
    fun saveWeatherRefreshSeconds(seconds: Int) {
        viewModelScope.launch {
            dataStore.saveWeatherRefreshSeconds(seconds)
        }
    }

    /** save the fallback city for failed location fixes; empty means follow the theme default */
    fun saveFallbackCity(city: String) {
        viewModelScope.launch {
            dataStore.saveFallbackCity(city)
        }
    }

    fun submitScanResult(content: String) {
        _pendingScanResult.value = content
    }

    fun consumeScanResult() {
        _pendingScanResult.value = null
    }

    /**
     * Handles launcher.list / snippet.list arriving either as PC pushes
     * (method set, data in params) or RPC responses (data in result).
     * Called from the websocket rawListener.
     */
    private fun handleMacroMessage(text: String) {
        try {
            val root = org.json.JSONObject(text)
            val method = root.optString("method")
            val params = when {
                method.isNotBlank() -> root.optJSONObject("params")
                else -> root.optJSONObject("result") // JSON-RPC 响应：result 即数据
            } ?: return
            when (method) {
                "launcher.list" -> {
                    val appsArray = params.optJSONArray("apps") ?: params.optJSONArray("list")
                    if (appsArray != null) {
                        val list = mutableListOf<LauncherApp>()
                        for (i in 0 until appsArray.length()) {
                            val obj = appsArray.optJSONObject(i) ?: continue
                            list.add(LauncherApp(
                                id = obj.optString("id", ""),
                                name = obj.optString("name", "App"),
                                iconUrl = obj.optString("icon").ifBlank { null },
                                position = obj.optInt("position", 0)
                            ))
                        }
                        _launcherApps.value = list
                    }
                }
                "snippet.list" -> {
                    val itemsArray = params.optJSONArray("snippets") ?: params.optJSONArray("list")
                    if (itemsArray != null) {
                        val list = mutableListOf<SnippetItem>()
                        for (i in 0 until itemsArray.length()) {
                            val obj = itemsArray.optJSONObject(i) ?: continue
                            list.add(SnippetItem(
                                id = obj.optString("id", ""),
                                label = obj.optString("label", "Snippet"),
                                content = obj.optString("content", ""),
                                category = obj.optString("category").ifBlank { null }
                            ))
                        }
                        _snippetItems.value = list
                    }
                }
                // method-less responses: the PC's result carries no method, sniff by structure
                "" -> {
                    val appsArray = params.optJSONArray("apps") ?: params.optJSONArray("list")
                    val snippetsArray = params.optJSONArray("snippets")
                    if (appsArray != null) {
                        val list = mutableListOf<LauncherApp>()
                        for (i in 0 until appsArray.length()) {
                            val obj = appsArray.optJSONObject(i) ?: continue
                            list.add(LauncherApp(
                                id = obj.optString("id", ""),
                                name = obj.optString("name", "App"),
                                iconUrl = obj.optString("icon").ifBlank { null },
                                position = obj.optInt("position", 0)
                            ))
                        }
                        _launcherApps.value = list
                    } else if (snippetsArray != null) {
                        val list = mutableListOf<SnippetItem>()
                        for (i in 0 until snippetsArray.length()) {
                            val obj = snippetsArray.optJSONObject(i) ?: continue
                            list.add(SnippetItem(
                                id = obj.optString("id", ""),
                                label = obj.optString("label", "Snippet"),
                                content = obj.optString("content", ""),
                                category = obj.optString("category").ifBlank { null }
                            ))
                        }
                        _snippetItems.value = list
                    }
                }
            }
        } catch (_: Exception) {}
    }

    fun requestLauncherList() {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("launcher.list", org.json.JSONObject(), nextRequestId()))
    }

    fun requestSnippetList() {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("snippet.list", org.json.JSONObject(), nextRequestId()))
    }

    fun openLauncher(appId: String) {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("launcher.open",
            org.json.JSONObject().put("id", appId), nextRequestId()))
    }

    fun injectSnippet(content: String) {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("snippet.inject",
            org.json.JSONObject().put("text", content), nextRequestId()))
    }

    private var requestSeq = 1000
    private fun nextRequestId(): Int = ++requestSeq

    override fun onCleared() {
        webSocket.release()
        super.onCleared()
    }

    fun refreshThemePackages() {
        viewModelScope.launch {
            val metas = withContext(Dispatchers.IO) { pushReceiveManager.getInstalledThemes() }
            if (metas.isNotEmpty()) {
                _themePackages.value = metas.mapIndexed { index, meta ->
                    ThemePackage(
                        themeId = meta.themeId,
                        name = meta.name,
                        version = meta.version,
                        author = "PC",
                        pageCount = meta.pageCount,
                        isActive = index == 0,
                        coverEmoji = "📦",
                        coverColor = 0xFF4F6EF7
                    )
                }
            } else {
                _themePackages.value = emptyList()
            }
        }
    }

    fun deleteTheme(themeId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { pushReceiveManager.deleteInstalledTheme(themeId) }
            refreshThemePackages()
        }
    }

    /**
     * Fills the theme list after the handshake. Local installs are the source
     * of truth (real pageCount/themeId, so installed themes can open); the PC
     * list only shows as a "pushable" hint when nothing is installed locally.
     */
    private fun populateThemePackages(themeList: List<String>) {
        viewModelScope.launch {
            val metas = withContext(Dispatchers.IO) { pushReceiveManager.getInstalledThemes() }
            if (metas.isNotEmpty()) {
                _themePackages.value = metas.mapIndexed { index, meta ->
                    ThemePackage(
                        themeId = meta.themeId,
                        name = meta.name,
                        version = meta.version,
                        author = "PC",
                        pageCount = meta.pageCount,
                        isActive = index == 0,
                        coverEmoji = "📦",
                        coverColor = 0xFF4F6EF7
                    )
                }
            } else if (themeList.isNotEmpty()) {
                // nothing installed locally: show the PC list as a non-openable hint
                _themePackages.value = themeList.mapIndexed { index, name ->
                    ThemePackage(
                        name = name,
                        version = "1.0.0",
                        author = "PC",
                        pageCount = 1,
                        isActive = index == 0
                    )
                }
            } else {
                _themePackages.value = emptyList()
            }
        }
    }
}
