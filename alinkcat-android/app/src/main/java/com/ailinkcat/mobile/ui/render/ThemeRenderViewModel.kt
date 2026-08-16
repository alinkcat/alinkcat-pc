package com.ailinkcat.mobile.ui.render

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.DataStoreManager
import com.ailinkcat.mobile.data.JsonRpc
import com.ailinkcat.mobile.data.model.ConnectionStatus
import com.ailinkcat.mobile.data.model.StoredConfig
import com.ailinkcat.mobile.domain.models.Action
import com.ailinkcat.mobile.domain.models.MediaState
import com.ailinkcat.mobile.domain.models.Theme
import com.ailinkcat.mobile.domain.repository.ThemeRepository
import com.ailinkcat.mobile.websocket.WebSocketManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * 主题包渲染状态管理：加载主题、建立数据连接、订阅实时数据、控件交互。
 */
class ThemeRenderViewModel(
    application: Application,
    private val themeId: String
) : AndroidViewModel(application) {

    private val repository = ThemeRepository(application)
    private val dataStore = DataStoreManager(application)
    private val appVersion = "1.0.0"

    data class RenderUiState(
        val theme: Theme? = null,
        val loading: Boolean = true,
        val error: String? = null,
        val currentPageIndex: Int = 0,
        val widgetData: Map<String, Float> = emptyMap(),
        val mediaState: MediaState = MediaState(),
        val connectionStatus: ConnectionStatus = ConnectionStatus.Idle,
        val showExitConfirm: Boolean = false,
        val isLandscape: Boolean = true
    )

    private val _uiState = MutableStateFlow(RenderUiState())
    val uiState: StateFlow<RenderUiState> = _uiState.asStateFlow()

    private var requestId = 100
    private var reconnectJob: Job? = null

    /** 标记是否已进入主题（enterTheme 已调用），用于在 handshake 完成后补发订阅。 */
    private var entered = false

    private val webSocket = WebSocketManager(
        context = application,
        listener = object : WebSocketManager.Listener {
            override fun onHandshakeSucceeded(
                deviceId: String?,
                serverVersion: String?,
                serverName: String?,
                themeList: List<String>
            ) {
                _uiState.update { it.copy(connectionStatus = ConnectionStatus.Connected) }
                // 如果 enterTheme 在 handshake 完成前已被调用，补发订阅
                if (entered) {
                    sendThemeEnter()
                }
            }

            override fun onConnectionClosed() {
                _uiState.update { it.copy(connectionStatus = ConnectionStatus.Disconnected) }
                scheduleReconnect()
            }

            override fun onConnectionFailed(
                errorType: com.ailinkcat.mobile.data.model.ConnectionErrorType,
                message: String
            ) {
                _uiState.update { it.copy(connectionStatus = ConnectionStatus.Error) }
                scheduleReconnect()
            }
        },
        rawListener = { text -> handleRawMessage(text) }
    )

    init {
        loadTheme()
        viewModelScope.launch {
            val config = dataStore.config.first()
            connect(config)
        }
    }

    private fun loadTheme() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            val result = repository.loadTheme(themeId)
            result.onSuccess { theme ->
                _uiState.update { it.copy(theme = theme, loading = false) }
            }.onFailure { e ->
                _uiState.update {
                    it.copy(
                        theme = null,
                        loading = false,
                        error = e.message ?: getApplication<Application>().getString(R.string.theme_load_failed)
                    )
                }
            }
        }
    }

    private fun connect(config: StoredConfig) {
        if (config.ip.isBlank()) return
        // 预览连接使用独立设备名，避免与主界面连接互踢
        val app = getApplication<Application>()
        val deviceName = config.deviceName.ifBlank { app.getString(R.string.default_device_name) }
        webSocket.connect(
            url = "ws://${config.ip}:${config.port}",
            pairingCode = config.pairCode,
            deviceName = "$deviceName (Display)",
            appVersion = appVersion
        )
    }

    private fun subscribeData() {
        val sources = JSONArray()
        DataSourceResolver.SUBSCRIBE_SOURCES.forEach { sources.put(it) }
        webSocket.send(
            JsonRpc.buildRequest(
                method = "monitor.subscribe",
                params = JSONObject().put("sources", sources),
                id = nextId()
            )
        )
    }

    private fun unsubscribeData() {
        webSocket.send(JsonRpc.buildRequest("monitor.unsubscribe",
            JSONObject(), nextId()))
    }

    /**
     * 用户进入主题包页面：发送 theme.enter 并订阅数据。
     * 如果 WebSocket 尚未连接，标记为待发送，handshake 完成后自动补发。
     */
    fun enterTheme() {
        entered = true
        sendThemeEnter()
    }

    private fun sendThemeEnter() {
        webSocket.send(JsonRpc.buildRequest("theme.enter",
            JSONObject().put("themeId", themeId), nextId()))
        subscribeData()
        // 主动拉取当前媒体状态
        webSocket.send(JsonRpc.buildRequest("media.get_current",
            JSONObject(), nextId()))
    }

    /**
     * 用户离开主题包页面：发送 theme.leave 并取消订阅。
     */
    fun leaveTheme() {
        entered = false
        webSocket.send(JsonRpc.buildRequest("theme.leave",
            JSONObject(), nextId()))
        unsubscribeData()
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = viewModelScope.launch {
            delay(5000)
            val config = dataStore.config.first()
            if (config.ip.isNotBlank()) {
                _uiState.update { it.copy(connectionStatus = ConnectionStatus.Connecting) }
                connect(config)
            }
        }
    }

    private fun handleRawMessage(text: String) {
        try {
            val root = JSONObject(text)
            val method = root.optString("method")
            Log.d("RenderVM", "handleRawMessage: method=$method text=$text")
            when (method) {
                "monitor.data", "data.update", "monitor.update" -> parseDataUpdate(root)
                "media.state.update", "media.update" -> parseMediaState(root)
                else -> Log.d("RenderVM", "Unhandled method: $method")
            }
        } catch (_: Exception) {
        }
    }

    private fun parseMediaState(root: JSONObject) {
        // 兼容主动推送（params）和 get_current 响应（result）
        val params = root.optJSONObject("params")
            ?: root.optJSONObject("result")
            ?: return
        val state = params.optJSONObject("state") ?: params
        val serverPosition = state.optLong("position", 0L)
        _uiState.update { it.copy(
            mediaState = MediaState(
                title = state.optString("title").ifBlank { null }
                    ?: state.optString("song").ifBlank { null },
                artist = state.optString("artist").ifBlank { null }
                    ?: state.optString("singer").ifBlank { null },
                coverUrl = state.optString("coverUrl").ifBlank { null }
                    ?: state.optString("cover").ifBlank { null },
                isPlaying = state.optBoolean("isPlaying", false),
                position = serverPosition,
                duration = state.optLong("duration", 0L),
                volume = state.optInt("volume", 50).coerceIn(0, 100),
                basePosition = serverPosition,
                baseSystemTime = System.currentTimeMillis()
            )
        ) }
    }

    /**
     * 解析实时数据快照，扁平化 network 对象：
     * {cpu, memory, disk, uptime, network:{upload, download}}
     * 兼容备用字段名：cpuUsage, memoryUsage, diskUsage, uploadSpeed, downloadSpeed, net_up, net_down
     */
    private fun parseDataUpdate(root: JSONObject) {
        val params = root.optJSONObject("params") ?: return
        val dataObj = params.optJSONObject("data") ?: params
        val map = mutableMapOf<String, Float>()
        val keys = dataObj.keys()

        val ALIASES = mapOf(
            "cpuUsage" to "cpu",
            "memoryUsage" to "memory",
            "mem" to "memory",
            "diskUsage" to "disk",
            "uploadSpeed" to "network.upload",
            "net_up" to "network.upload",
            "downloadSpeed" to "network.download",
            "net_down" to "network.download",
            "batteryLevel" to "battery",
            "battery_level" to "battery"
        )

        while (keys.hasNext()) {
            val key = keys.next()
            if (key == "network") {
                val net = dataObj.optJSONObject("network") ?: continue
                net.optDouble("upload").takeIf { !it.isNaN() }?.let { map["network.upload"] = it.toFloat() }
                net.optDouble("download").takeIf { !it.isNaN() }?.let { map["network.download"] = it.toFloat() }
            } else if (key == "battery") {
                // 兼容两种推送格式：battery: 80 或 battery: { level: 80, charging: true }
                val batteryObj = dataObj.optJSONObject("battery")
                if (batteryObj != null) {
                    batteryObj.optDouble("level").takeIf { !it.isNaN() }?.let { map["battery"] = it.toFloat() }
                } else {
                    val raw = dataObj.optDouble(key).takeIf { !it.isNaN() }?.toFloat()
                    if (raw != null) {
                        map[key] = raw
                        ALIASES[key]?.let { alias -> map[alias] = raw }
                    }
                }
            } else {
                val raw = dataObj.optDouble(key).takeIf { !it.isNaN() }?.toFloat()
                if (raw != null) {
                    // 同时写入原始键和别名映射后的标准键，确保渲染器两种都能读到
                    map[key] = raw
                    ALIASES[key]?.let { alias -> map[alias] = raw }
                }
            }
        }
        if (map.isNotEmpty()) {
            Log.d("RenderVM", "parseDataUpdate: widgetData updated keys=${map.keys}")
            _uiState.update { it.copy(widgetData = it.widgetData + map) }
        }
    }

    /**
     * 控件点击：根据动作类型分发处理。
     * - switch_page: 切换页面
     * - toggle_widget: 切换控件可见性
     * - open_link: 用浏览器打开链接
     * - system_command: 通过 WebSocket 发送 action.execute
     * - launcher_open: 启动应用
     * - media_*: 媒体控制
     * - 其他: 发送 action.execute RPC 到 PC
     */
    fun executeAction(widgetId: String, action: Action) {
        when (action.type) {
            "switch_page" -> {
                val pageIdx = action.content?.toIntOrNull()
                if (pageIdx != null && pageIdx >= 0 && pageIdx < (_uiState.value.theme?.pages?.size ?: 0)) {
                    _uiState.update { it.copy(currentPageIndex = pageIdx) }
                }
                return
            }
            "toggle_widget" -> {
                // 通过 WebSocket 通知 PC 端切换控件可见性
                val params = JSONObject()
                    .put("widgetId", action.content ?: widgetId)
                    .put("action", "toggle_visibility")
                webSocket.send(JsonRpc.buildRequest("action.execute", params, nextId()))
                return
            }
            "open_link", "url" -> {
                val url = action.content
                if (!url.isNullOrBlank()) {
                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    getApplication<android.app.Application>().startActivity(intent)
                }
                return
            }
            "system_command", "command" -> {
                val params = JSONObject()
                    .put("widgetId", widgetId)
                    .put("action", action.asJsonValue())
                webSocket.send(JsonRpc.buildRequest("action.execute", params, nextId()))
                return
            }
            "launcher_open" -> {
                webSocket.send(JsonRpc.buildRequest("launcher.open",
                    JSONObject().put("id", widgetId), nextId()))
                return
            }
        }
        if (action.type.startsWith("media_")) {
            val mediaAction = when (action.type) {
                "media_play_pause" -> "play_pause"
                "media_next" -> "next"
                "media_previous" -> "previous"
                "media_volume_set" -> "volume_set"
                else -> "play_pause"
            }
            val params = JSONObject().put("action", mediaAction)
            if (mediaAction == "volume_set") {
                params.put("volume", action.content?.toIntOrNull()?.coerceIn(0, 100) ?: 50)
            }
            webSocket.send(JsonRpc.buildRequest("media.control", params, nextId()))
            return
        }
        // 默认：发送 action.execute RPC
        val params = JSONObject()
            .put("widgetId", widgetId)
            .put("action", action.asJsonValue())
        webSocket.send(JsonRpc.buildRequest("action.execute", params, nextId()))
    }
    
    /**
     * 设置当前页面索引（用于 switch_page 联动）。
     */
    fun setPage(index: Int) {
        onPageChanged(index)
    }
    
    /**
     * 切换指定控件的可见性（用于 toggle_widget 联动）。
     */
    fun toggleWidgetVisibility(widgetId: String) {
        // 通过 WebSocket 通知 PC 端
        webSocket.send(JsonRpc.buildRequest("action.execute",
            JSONObject()
                .put("widgetId", widgetId)
                .put("action", "toggle_visibility"),
            nextId()))
    }

    /**
     * 便签点击：发送 snippet.inject 指令将文本注入 PC 端光标位置。
     */
    fun executeSnippet(content: String) {
        webSocket.send(JsonRpc.buildRequest("snippet.inject",
            JSONObject().put("text", content), nextId()))
    }

    /**
     * 媒体控制指令：发送 media.control。
     * action: "play_pause" | "next" | "previous" | "volume_set"
     */
    fun executeMediaCommand(action: String) {
        webSocket.send(JsonRpc.buildRequest("media.control",
            JSONObject().put("action", action), nextId()))
    }

    fun onPageChanged(index: Int) {
        _uiState.update { it.copy(currentPageIndex = index) }
    }

    fun requestExit() {
        _uiState.update { it.copy(showExitConfirm = true) }
    }

    fun dismissExitConfirm() {
        _uiState.update { it.copy(showExitConfirm = false) }
    }

    fun retry() {
        loadTheme()
        viewModelScope.launch { connect(dataStore.config.first()) }
    }

    /** 退出前关闭数据连接。 */
    fun releaseConnection() {
        reconnectJob?.cancel()
        webSocket.close()
    }

    private fun nextId(): Int = ++requestId

    override fun onCleared() {
        reconnectJob?.cancel()
        webSocket.release()
        super.onCleared()
    }

    /**
     * 横竖屏切换时由 Activity 调用，触发状态更新。
     * 实际的布局重新计算由 Compose BoxWithConstraints 自动完成。
     */
    fun onConfigurationChanged(isLandscape: Boolean) {
        _uiState.update { it.copy(isLandscape = isLandscape) }
    }

    companion object {
        fun factory(themeId: String): ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
                    as Application
                ThemeRenderViewModel(app, themeId)
            }
        }
    }
}
