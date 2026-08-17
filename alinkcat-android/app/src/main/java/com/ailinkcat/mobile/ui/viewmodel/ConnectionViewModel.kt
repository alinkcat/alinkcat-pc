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

    /** PC 端远程切换主题事件（theme.switch）。 */
    private val _themeSwitchEvent = MutableSharedFlow<String>(extraBufferCapacity = 1, onBufferOverflow = kotlinx.coroutines.channels.BufferOverflow.DROP_OLDEST)
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
                    _state.value = ConnectionState(
                        status = ConnectionStatus.Connected,
                        deviceName = serverName,
                        serverVersion = serverVersion
                    )
                    populateThemePackages(themeList)
                }
            }

            override fun onConnectionClosed() {
                // 接收中连接断开：自动清理中止的接收
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
                // 启动自动连接失败时，自动重试
                onAutoConnectFailed()
            }
        },
        pushHandler = pushReceiveManager,
        rawListener = { text -> handleMacroMessage(text) }
    )

    init {
        // 推送确认/拒绝/忙碌响应通过 WebSocket 发送
        pushReceiveManager.setResponseSender { json -> webSocket.sendResponse(json) }
        // 远程切换主题
        webSocket.themeSwitchListener = { themeId ->
            viewModelScope.launch {
                if (pushReceiveManager.getInstalledThemes().any { it.themeId == themeId }) {
                    _themeSwitchEvent.tryEmit(themeId)
                } else {
                    refreshThemePackages()
                }
            }
        }
        // 启动时自动连接（最多重试 3 次，间隔 2 秒）
    private var autoRetryCount = 0

    private fun autoConnect() {
        viewModelScope.launch {
            val cfg = dataStore.config.first()
            if (cfg.ip.isNotBlank() && cfg.port.isNotBlank() && cfg.pairCode.isNotBlank()) {
                autoRetryCount = 0
                _state.value = ConnectionState(status = ConnectionStatus.Connecting)
                webSocket.connect("ws://${cfg.ip}:${cfg.port}", cfg.pairCode, cfg.deviceName, appVersion)
            }
        }
    }

    private fun onAutoConnectFailed() {
        autoRetryCount++
        if (autoRetryCount < 3) {
            _state.value = ConnectionState(status = ConnectionStatus.Connecting)
            viewModelScope.launch {
                delay(2000)
                val cfg = dataStore.config.first()
                webSocket.connect("ws://${cfg.ip}:${cfg.port}", cfg.pairCode, cfg.deviceName, appVersion)
            }
        }
    }

    init {
        // 推送确认/拒绝/忙碌响应通过 WebSocket 发送
        pushReceiveManager.setResponseSender { json -> webSocket.sendResponse(json) }
        // 远程切换主题
        webSocket.themeSwitchListener = { themeId ->
            viewModelScope.launch {
                if (pushReceiveManager.getInstalledThemes().any { it.themeId == themeId }) {
                    _themeSwitchEvent.tryEmit(themeId)
                } else {
                    refreshThemePackages()
                }
            }
        }
        // 启动时自动连接
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
        viewModelScope.launch {
            dataStore.saveConnection(ip, port, pairCode)
            dataStore.saveLastConnected(ip, port)
            val deviceName = savedConfig.value.deviceName
            webSocket.connect("ws://$ip:$port", pairCode, deviceName, appVersion)
        }
    }

    fun disconnect() {
        // 断开连接：接收中的传输保留 .part 标记为中断，等待恢复
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
     * 由 WebSocket rawListener 调用。
     */
    private fun handleMacroMessage(text: String) {
        try {
            val root = org.json.JSONObject(text)
            when (root.optString("method")) {
                "launcher.list" -> {
                    val appsArray = root.optJSONObject("params")?.optJSONArray("apps")
                        ?: root.optJSONArray("params")
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
                    val itemsArray = root.optJSONObject("params")?.optJSONArray("snippets")
                        ?: root.optJSONArray("params")
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
                        pageCount = 1,
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
     * 以服务端握手返回的主题包列表填充列表；为空时退回示例数据。
     */
    private fun populateThemePackages(themeList: List<String>) {
        if (themeList.isNotEmpty()) {
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
            loadMockThemePackagesIfEmpty()
        }
    }

    private fun loadMockThemePackagesIfEmpty() {
        if (_themePackages.value.isNotEmpty()) return
        _themePackages.value = listOf(
            ThemePackage(name = "Aurora Blue · Business", version = "1.2.0", author = "iLinkCat Studio", pageCount = 3, isActive = true),
            ThemePackage(name = "Sakura Pink · Sweet", version = "0.9.1", author = "CatWorks", pageCount = 2, isActive = false, coverEmoji = "🌸", coverColor = 0xFFF06292),
            ThemePackage(name = "Dark Night Geek", version = "2.0.0", author = "NeoPixel", pageCount = 4, isActive = false, coverEmoji = "🌙", coverColor = 0xFF343A5C),
            ThemePackage(name = "Mint Green · Fresh", version = "1.0.3", author = "Mint Tea", pageCount = 5, isActive = false, coverEmoji = "🍃", coverColor = 0xFF4DB6AC)
        )
    }
}
