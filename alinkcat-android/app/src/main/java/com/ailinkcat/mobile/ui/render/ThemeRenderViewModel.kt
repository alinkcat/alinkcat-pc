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
import com.ailinkcat.mobile.i18n.LanguageManager
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

/** theme render viewmodel: loads the theme, opens the data connection, subscribes to live data, handles widget actions. */
class ThemeRenderViewModel(
    application: Application,
    private val themeId: String
) : AndroidViewModel(application) {

    private val repository = ThemeRepository(application)
    private val dataStore = DataStoreManager(application)
    private val appVersion = com.ailinkcat.mobile.BuildConfig.VERSION_NAME

    data class RenderUiState(
        val theme: Theme? = null,
        val loading: Boolean = true,
        val error: String? = null,
        val currentPageIndex: Int = 0,
        val widgetData: Map<String, Float> = emptyMap(),
        val mediaState: MediaState = MediaState(),
        val connectionStatus: ConnectionStatus = ConnectionStatus.Idle,
        val showExitConfirm: Boolean = false,
        val isLandscape: Boolean = true,
        val actionError: String? = null
    )

    private val _uiState = MutableStateFlow(RenderUiState())
    val uiState: StateFlow<RenderUiState> = _uiState.asStateFlow()

    private val requestId = java.util.concurrent.atomic.AtomicInteger(100)
    private var reconnectJob: Job? = null
    private var reconnectAttempt = 0

    /** true once enterTheme ran, so the handshake callback can resend the subscribe. Read from OkHttp threads, hence @Volatile. */
    @Volatile
    private var entered = false

    /** whether theme.enter actually went out; send's return value doubles as the connectivity check. */
    @Volatile
    private var enterSent = false

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
                reconnectAttempt = 0
                // enterTheme fired before the handshake finished, resend now
                if (entered && !enterSent) {
                    if (sendThemeEnter()) enterSent = true
                }
            }

            override fun onConnectionClosed() {
                // the new connection must re-send theme.enter/media.subscribe,
                // otherwise the page renders a frozen snapshot forever
                enterSent = false
                _uiState.update { it.copy(connectionStatus = ConnectionStatus.Disconnected) }
                scheduleReconnect()
            }

            override fun onConnectionFailed(
                errorType: com.ailinkcat.mobile.data.model.ConnectionErrorType,
                message: String
            ) {
                enterSent = false
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
        // separate device name so this display connection doesn't kick the main one
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
     * Enter the theme page: send theme.enter + subscribe. Queued until the
     * handshake completes if the socket isn't up yet (idempotent).
     */
    fun enterTheme() {
        entered = true
        if (!enterSent) {
            if (sendThemeEnter()) enterSent = true
        }
    }

    /** @return true if theme.enter actually went out; false means it's queued for after the handshake. */
    private fun sendThemeEnter(): Boolean {
        val ok = webSocket.send(JsonRpc.buildRequest("theme.enter",
            JSONObject().put("themeId", themeId), nextId()))
        subscribeData()
        webSocket.send(JsonRpc.buildRequest("media.get_current",
            JSONObject(), nextId()))
        return ok
    }

    fun leaveTheme() {
        entered = false
        enterSent = false
        webSocket.send(JsonRpc.buildRequest("theme.leave",
            JSONObject(), nextId()))
        unsubscribeData()
    }

    /**
     * Reconnect with exponential backoff (5s -> 60s cap) + jitter; retrying
     * every 5s against an offline PC drains battery and spams server logs.
     */
    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        val base = (5_000L shl reconnectAttempt.coerceAtMost(3)).coerceAtMost(60_000L)
        reconnectAttempt++
        val jitter = (0..500L).random()
        reconnectJob = viewModelScope.launch {
            delay(base + jitter)
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
            if (root.has("error") && root.optJSONObject("error") != null) {
                val err = root.optJSONObject("error")
                val msg = err?.optString("message") ?: LanguageManager.get(getApplication()).getString(R.string.operation_failed)
                _uiState.update { it.copy(actionError = msg) }
                return
            }
            val method = root.optString("method")
            if (method.isBlank()) {
                // method-less responses: only pick up media state, ignore the rest
                // so random RPC replies don't pollute mediaState
                val result = root.optJSONObject("result")
                if (result != null && (
                        result.has("position") || result.has("title") || result.has("duration")
                            || result.has("isPlaying") || result.has("state")
                        )) {
                    parseMediaState(root)
                }
                return
            }
            Log.d(TAG, "handleRawMessage: method=$method")
            when (method) {
                "monitor.data", "data.update", "monitor.update" -> parseDataUpdate(root)
                "media.state.update", "media.update" -> parseMediaState(root)
                else -> Log.d(TAG, "Unhandled method: $method")
            }
        } catch (e: Exception) {
            Log.e(TAG, "handleRawMessage parse error: ${e.message}")
        }
    }

    private fun parseMediaState(root: JSONObject) {
        // handles both pushes (params) and get_current responses (result)
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
                    ?: state.optString("cover").ifBlank { null }
                    // the PC side names its cover field "thumbnail"
                    ?: state.optString("thumbnail").ifBlank { null },
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
     * Flattens live data snapshots ({cpu, memory, disk, uptime,
     * network:{upload, download}}) and accepts the PC's alternate field names.
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
                // battery arrives either as 80 or { level: 80, charging: true }
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
                    // store under the raw key and the aliased standard key so
                    // renderers can read either
                    map[key] = raw
                    ALIASES[key]?.let { alias -> map[alias] = raw }
                }
            }
        }
        if (map.isNotEmpty()) {
            // whitelist keys so widgetData can't grow unbounded; replace
            // wholesale so stale values don't linger
            val filtered = map.filterKeys { it in DataSourceResolver.INTERNAL_KEYS }
            if (filtered.isNotEmpty()) {
                _uiState.update { it.copy(widgetData = filtered) }
            }
        }
    }

    /**
     * Widget tap dispatch: switch_page / toggle_widget are handled locally,
     * media_* maps to media.control, everything else goes to the PC as
     * action.execute.
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
                val params = JSONObject()
                    .put("widgetId", action.content ?: widgetId)
                    .put("action", "toggle_visibility")
                webSocket.send(JsonRpc.buildRequest("action.execute", params, nextId()))
                return
            }
            "open_link", "url" -> {
                val url = action.content
                if (!url.isNullOrBlank()) {
                    // http/https only, so a theme pack can't fire arbitrary
                    // schemes like file: or javascript:
                    val uri = try {
                        android.net.Uri.parse(url)
                    } catch (_: Exception) {
                        null
                    }
                    val scheme = uri?.scheme?.lowercase()
                    if (scheme != "http" && scheme != "https") {
                        _uiState.update { it.copy(actionError = LanguageManager.get(getApplication()).getString(R.string.unsupported_link, url)) }
                        return
                    }
                    try {
                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, uri)
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        getApplication<android.app.Application>().startActivity(intent)
                    } catch (e: Exception) {
                        Log.e(TAG, "open_link failed: ${e.message}")
                        _uiState.update { it.copy(actionError = LanguageManager.get(getApplication()).getString(R.string.cannot_open_link)) }
                    }
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
            val path = action.content
            if (!path.isNullOrBlank()) {
                webSocket.send(JsonRpc.buildRequest("launcher.open",
                    JSONObject().put("path", path), nextId()))
            }
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
        val params = JSONObject()
            .put("widgetId", widgetId)
            .put("action", action.asJsonValue())
        webSocket.send(JsonRpc.buildRequest("action.execute", params, nextId()))
    }

    fun setPage(index: Int) {
        onPageChanged(index)
    }

    fun toggleWidgetVisibility(widgetId: String) {
        webSocket.send(JsonRpc.buildRequest("action.execute",
            JSONObject()
                .put("widgetId", widgetId)
                .put("action", "toggle_visibility"),
            nextId()))
    }

    /** sticky note tap: inject the text at the PC cursor */
    fun executeSnippet(content: String) {
        webSocket.send(JsonRpc.buildRequest("snippet.inject",
            JSONObject().put("text", content), nextId()))
    }

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

    fun clearActionError() {
        _uiState.update { it.copy(actionError = null) }
    }

    fun retry() {
        loadTheme()
        viewModelScope.launch { connect(dataStore.config.first()) }
    }

    fun releaseConnection() {
        reconnectJob?.cancel()
        webSocket.close()
    }

    private fun nextId(): Int = requestId.incrementAndGet()

    override fun onCleared() {
        reconnectJob?.cancel()
        webSocket.release()
        super.onCleared()
    }

    /** called by the activity on rotation; layout recomputes via BoxWithConstraints */
    fun onConfigurationChanged(isLandscape: Boolean) {
        _uiState.update { it.copy(isLandscape = isLandscape) }
    }

    companion object {
        private const val TAG = "RenderVM"

        fun factory(themeId: String): ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
                    as Application
                ThemeRenderViewModel(app, themeId)
            }
        }
    }
}
