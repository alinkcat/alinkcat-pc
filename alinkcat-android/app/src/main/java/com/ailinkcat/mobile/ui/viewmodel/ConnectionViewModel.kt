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

/**
 * 连接状态管理：WebSocket 连接 + JSON-RPC 握手（配对码验证）+ 配置持久化 + 主题包数据。
 */
class ConnectionViewModel(application: Application) : AndroidViewModel(application) {

    private val appVersion = "1.0.0"

    private val dataStore = DataStoreManager(application)

    val savedConfig: StateFlow<StoredConfig> =
        dataStore.config.stateIn(viewModelScope, SharingStarted.Eagerly, StoredConfig())

    private val _state = MutableStateFlow(ConnectionState())
    val state: StateFlow<ConnectionState> = _state.asStateFlow()

    private val _themePackages = MutableStateFlow<List<ThemePackage>>(emptyList())
    val themePackages: StateFlow<List<ThemePackage>> = _themePackages.asStateFlow()

    private val _pendingScanResult = MutableStateFlow<String?>(null)
    val pendingScanResult: StateFlow<String?> = _pendingScanResult.asStateFlow()

    /** PC 端远程切换主题事件（theme.switch）。replay=1：防止收集者晚注册时事件被 DROP 丢失。 */
    private val _themeSwitchEvent = MutableSharedFlow<String>(replay = 1)
    val themeSwitchEvent: SharedFlow<String> = _themeSwitchEvent.asSharedFlow()

    /** 快捷启动应用列表（来自 PC 端 launcher.list）。 */
    private val _launcherApps = MutableStateFlow<List<LauncherApp>>(emptyList())
    val launcherApps: StateFlow<List<LauncherApp>> = _launcherApps.asStateFlow()

    /** 文本片段列表（来自 PC 端 snippet.list）。 */
    private val _snippetItems = MutableStateFlow<List<SnippetItem>>(emptyList())
    val snippetItems: StateFlow<List<SnippetItem>> = _snippetItems.asStateFlow()

    /**
     * 主题包推送接收管理器（与 WebSocket 共用同一连接）。
     */
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
                // 连接断开时清理中止的接收
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
                onAutoConnectFailed()
            }
        },
        pushHandler = pushReceiveManager,
        rawListener = { text -> handleMacroMessage(text) }
    )

    /** 启动时自动连接重试 */
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
        // 推送确认/拒绝/忙碌响应通过 WebSocket 发送
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

    /**
     * 连接：校验输入 -> 持久化 -> 建立 WebSocket 连接并发送握手请求（携带配对码）。
     * URL 格式：ws://{ip}:{port}
     */
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
        // 接收中的传输保留 .part 标记中断，等待恢复
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

    /** 保存天气刷新间隔（秒）；<=0 表示跟随主题默认。 */
    fun saveWeatherRefreshSeconds(seconds: Int) {
        viewModelScope.launch {
            dataStore.saveWeatherRefreshSeconds(seconds)
        }
    }

    /** 保存定位失败兜底城市名；空表示跟随主题默认。 */
    fun saveFallbackCity(city: String) {
        viewModelScope.launch {
            dataStore.saveFallbackCity(city)
        }
    }

    /**
     * 扫码页返回的原始内容，配置页收集后解析并填充表单。
     */
    fun submitScanResult(content: String) {
        _pendingScanResult.value = content
    }

    fun consumeScanResult() {
        _pendingScanResult.value = null
    }

    /**
     * 处理宏/片段相关消息（launcher.list / snippet.list）。
     * 兼容两种形式：PC 端主动推送（method 非空，数据在 params）与
     * JSON-RPC 响应（method 为空，数据在 result）。
     * 由 WebSocket rawListener 调用。
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
                // 无 method 的响应：PC 端 result 不带 method，按结构嗅探
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

    /** 请求 PC 端发送快捷启动列表。 */
    fun requestLauncherList() {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("launcher.list", org.json.JSONObject(), nextRequestId()))
    }

    /** 请求 PC 端发送文本片段列表。 */
    fun requestSnippetList() {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("snippet.list", org.json.JSONObject(), nextRequestId()))
    }

    /** 通知 PC 端打开指定快捷启动项。 */
    fun openLauncher(appId: String) {
        webSocket.send(com.ailinkcat.mobile.data.JsonRpc.buildRequest("launcher.open",
            org.json.JSONObject().put("id", appId), nextRequestId()))
    }

    /** 注入文本片段到 PC 端光标位置。 */
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

    /**
     * 从已安装目录刷新主题包列表（接收完成后调用）。
     */
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

    /**
     * 删除本地主题包并刷新列表。
     */
    fun deleteTheme(themeId: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { pushReceiveManager.deleteInstalledTheme(themeId) }
            refreshThemePackages()
        }
    }

    /**
     * 握手成功后填充主题列表。
     * 展示一律以本地安装数据（含真实 pageCount/themeId）为准，保证已安装主题可打开；
     * PC 端列表仅在本地无任何主题时作为"可推送"提示（themeId 为空，点击提示未下载）。
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
                // 本地无主题：以 PC 列表展示，仅提示不可打开
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
