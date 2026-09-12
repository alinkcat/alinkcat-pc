package com.ailinkcat.mobile.websocket

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.JsonRpc
import com.ailinkcat.mobile.data.model.ConnectionErrorType
import com.ailinkcat.mobile.websocket.models.ReceiveState
import com.ailinkcat.mobile.websocket.models.ThemePushCancel
import com.ailinkcat.mobile.websocket.models.ThemePushChunk
import com.ailinkcat.mobile.websocket.models.ThemePushComplete
import com.ailinkcat.mobile.websocket.models.ThemePushError
import com.ailinkcat.mobile.websocket.models.ThemePushStart
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 主题包推送原始消息处理器（接收 ThemePush* 消息，交由 PushReceiveManager 实现）。
 * 携带 JSON-RPC 请求 id 用于回执（ready/rejected/chunk ack 等）。
 */
interface PushMessageHandler {
    fun onThemePushStart(requestId: Int, params: ThemePushStart)
    fun onThemePushChunk(requestId: Int, params: ThemePushChunk)
    fun onThemePushComplete(requestId: Int, params: ThemePushComplete)
    fun onThemePushCancel(requestId: Int, params: ThemePushCancel)
    fun onThemePushError(requestId: Int, params: ThemePushError)
}

/**
 * 推送接收状态监听器（注册在 ViewModel 中，用于驱动进度对话框）。
 */
interface PushReceiveListener {
    fun onPushStart(state: ReceiveState)
    fun onPushProgress(state: ReceiveState)
    fun onPushComplete(state: ReceiveState)
    fun onPushCancelled(state: ReceiveState)
    fun onPushFailed(state: ReceiveState, error: String)
}

/**
 * 基于 OkHttp 的 WebSocket 客户端。
 * - URL 格式：ws://{ip}:{port}，不附加任何路径
 * - 连接超时：5 秒；握手超时：10 秒
 * - 连接建立后自动发送 JSON-RPC handshake 请求（携带配对码）
 * - 解析主题包推送通知（theme.push.*）并转发给 [PushMessageHandler]
 */
class WebSocketManager(
    private val context: Context,
    private val listener: Listener,
    private val pushHandler: PushMessageHandler? = null,
    private val rawListener: ((String) -> Unit)? = null
) {

    interface Listener {
        fun onHandshakeSucceeded(
            deviceId: String?,
            serverVersion: String?,
            serverName: String?,
            themeList: List<String>
        )

        fun onConnectionClosed()
        fun onConnectionFailed(errorType: ConnectionErrorType, message: String)
    }

    companion object {
        private const val TAG = "WebSocketManager"
        private const val CONNECT_TIMEOUT_SECS = 5L
        private const val HANDSHAKE_TIMEOUT_MS = 10_000L
        private const val ERR_INVALID_PAIRING_CODE = -32001
        private const val ERR_HANDSHAKE_TIMEOUT = -32002
        private const val ERR_DUPLICATE_CONNECTION = -32003
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(CONNECT_TIMEOUT_SECS, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())

    private var webSocket: WebSocket? = null

    @Volatile
    private var expectedClose = false

    /** 连接代数：每次 connect() 递增，回调校验代数一致才上报，防止旧连接孤儿回调触发重复重连。 */
    @Volatile
    private var connectionGeneration = 0L

    /** PC 端远程切换主题监听器（theme.switch）。 */
    @Volatile
    var themeSwitchListener: ((themeId: String) -> Unit)? = null

    private val handshakePending = AtomicBoolean(false)

    private val handshakeTimeoutTask = Runnable {
        if (handshakePending.compareAndSet(true, false)) {
            Log.e(TAG, "Handshake timeout: no response in ${HANDSHAKE_TIMEOUT_MS / 1000}s")
            // 必须关闭底层连接，否则重连后新旧连接并存（双连接双订阅）
            try {
                webSocket?.cancel()
            } catch (_: Exception) {
            }
            listener.onConnectionFailed(
                ConnectionErrorType.HANDSHAKE_TIMEOUT,
                context.getString(R.string.handshake_timeout)
            )
        }
    }

    /**
     * 建立连接并自动发送握手请求。
     * @param url 形如 ws://192.168.1.100:9527
     */
    fun connect(url: String, pairingCode: String, deviceName: String, appVersion: String) {
        // 递增代数，让旧连接的后续回调失效
        connectionGeneration++
        val gen = connectionGeneration
        expectedClose = false
        try {
            webSocket?.cancel()
        } catch (_: Exception) {
        }
        Log.d(TAG, "Connecting to $url")
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (gen != connectionGeneration) {
                    try {
                        webSocket.cancel()
                    } catch (_: Exception) {
                    }
                    return
                }
                Log.d(TAG, "WebSocket connected")
                handshakePending.set(true)
                mainHandler.postDelayed(handshakeTimeoutTask, HANDSHAKE_TIMEOUT_MS)
                webSocket.send(
                    JsonRpc.buildHandshakeRequest(deviceName, appVersion, pairingCode)
                )
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (gen != connectionGeneration) return
                val message = JsonRpc.parseMessage(text) ?: return
                val method = message.method
                if (method == null) {
                    // 无 method 的是 JSON-RPC 响应：id=1 为握手响应，其余（media.get_current 等）转发原始监听器
                    if (message.id == 1) {
                        handleHandshakeResponse(text)
                    } else {
                        rawListener?.invoke(text)
                    }
                    return
                }
                if (method == "handshake") {
                    handleHandshakeResponse(text)
                    return
                }
                if (method.startsWith("theme.push.")) {
                    Log.d(TAG, "Push notification: $method (id=${message.id})")
                    routePushMessage(message)
                    return
                }
                if (method == "theme.switch") {
                    val themeId = message.params?.optString("themeId")
                    if (themeId != null) {
                        Log.d(TAG, "Theme switch requested: $themeId")
                        themeSwitchListener?.invoke(themeId)
                    }
                    return
                }
                if (method.startsWith("monitor.")) {
                    Log.d(TAG, "Monitor message: $method (id=${message.id})")
                    rawListener?.invoke(text)
                    return
                }
                rawListener?.invoke(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                if (gen != connectionGeneration) return
                try {
                    webSocket.close(1000, null)
                } catch (_: Exception) {
                }
                if (!expectedClose) listener.onConnectionClosed()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (gen != connectionGeneration) return
                handshakePending.set(false)
                mainHandler.removeCallbacks(handshakeTimeoutTask)
                if (!expectedClose) listener.onConnectionClosed()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (gen != connectionGeneration) return
                handshakePending.set(false)
                mainHandler.removeCallbacks(handshakeTimeoutTask)
                if (!expectedClose) {
                    Log.e(TAG, "Connection failed: ${t.message}")
                    val (type, message) = classifyFailure(t)
                    listener.onConnectionFailed(type, message)
                }
            }
        })
    }

    private fun handleHandshakeResponse(text: String) {
        val result = JsonRpc.parseHandshakeResponse(text)
        if (result.errorMessage == null) {
            if (handshakePending.compareAndSet(true, false)) {
                mainHandler.removeCallbacks(handshakeTimeoutTask)
                Log.d(TAG, "Handshake successful")
                listener.onHandshakeSucceeded(
                    result.deviceId,
                    result.serverVersion,
                    result.serverName,
                    result.themeList
                )
            }
        } else {
            val type = when (result.errorCode) {
                ERR_INVALID_PAIRING_CODE -> ConnectionErrorType.PAIRING_CODE_ERROR
                ERR_HANDSHAKE_TIMEOUT -> ConnectionErrorType.HANDSHAKE_TIMEOUT
                ERR_DUPLICATE_CONNECTION -> ConnectionErrorType.DUPLICATE_CONNECTION
                else -> ConnectionErrorType.UNKNOWN
            }
            if (handshakePending.compareAndSet(true, false)) {
                mainHandler.removeCallbacks(handshakeTimeoutTask)
                Log.e(TAG, "Handshake failed: ${result.errorMessage}")
                listener.onConnectionFailed(type, result.errorMessage)
            }
        }
    }

    private fun routePushMessage(message: JsonRpc.RpcMessage) {
        val handler = pushHandler ?: return
        val params = message.params ?: return
        when (message.method) {
            "theme.push.start" -> ThemePushStart.from(params)
                ?.let { handler.onThemePushStart(message.id, it) }
            "theme.push.chunk" -> ThemePushChunk.from(params)
                ?.let { handler.onThemePushChunk(message.id, it) }
            "theme.push.complete" -> ThemePushComplete.from(params)
                ?.let { handler.onThemePushComplete(message.id, it) }
            "theme.push.cancel" -> ThemePushCancel.from(params)
                ?.let { handler.onThemePushCancel(message.id, it) }
            "theme.push.error" -> ThemePushError.from(params)
                ?.let { handler.onThemePushError(message.id, it) }
        }
    }

    /**
     * 发送 JSON-RPC 消息。返回是否真正下发（连接不存在/未打开时为 false，调用方需感知）。
     */
    fun send(text: String): Boolean {
        val ws = webSocket
        if (ws == null) {
            Log.w(TAG, "send() ignored: no active websocket")
            return false
        }
        return try {
            ws.send(text)
        } catch (_: Exception) {
            Log.w(TAG, "send() failed: socket error")
            false
        }
    }

    /**
     * 发送 JSON-RPC 响应（推送确认 / 拒绝 / 错误等）。返回是否真正下发。
     */
    fun sendResponse(responseJson: String): Boolean {
        return send(responseJson)
    }

    /**
     * 关闭当前连接（保留 OkHttpClient 以便下次重连）。
     */
    fun close() {
        expectedClose = true
        mainHandler.removeCallbacks(handshakeTimeoutTask)
        try {
            webSocket?.close(1000, "bye")
        } catch (_: Exception) {
        }
        webSocket = null
    }

    /**
     * 释放底层资源（在 ViewModel onCleared 时调用）。
     */
    fun release() {
        close()
        client.dispatcher.executorService.shutdown()
    }

    private fun classifyFailure(t: Throwable): Pair<ConnectionErrorType, String> {
        val msg = t.message ?: t.javaClass.simpleName
        return when {
            t is SocketTimeoutException ->
                ConnectionErrorType.CONNECTION_TIMEOUT to context.getString(R.string.connection_timeout)

            t is ConnectException ->
                ConnectionErrorType.PORT_CLOSED to context.getString(R.string.port_closed)

            t is UnknownHostException || t is NoRouteToHostException ->
                ConnectionErrorType.NETWORK_UNREACHABLE to context.getString(R.string.network_unreachable)

            msg.contains("timeout", ignoreCase = true) ->
                ConnectionErrorType.CONNECTION_TIMEOUT to context.getString(R.string.connection_timeout)

            msg.contains("refused", ignoreCase = true) ||
                msg.contains("ECONNREFUSED", ignoreCase = true) ->
                ConnectionErrorType.PORT_CLOSED to context.getString(R.string.port_closed)

            msg.contains("unreachable", ignoreCase = true) ||
                msg.contains("ENETUNREACH", ignoreCase = true) ||
                msg.contains("EHOSTUNREACH", ignoreCase = true) ||
                msg.contains("NoRouteToHost", ignoreCase = true) ->
                ConnectionErrorType.NETWORK_UNREACHABLE to context.getString(R.string.network_unreachable)

            else -> ConnectionErrorType.UNKNOWN to (t.message ?: context.getString(R.string.connection_failed))
        }
    }
}
