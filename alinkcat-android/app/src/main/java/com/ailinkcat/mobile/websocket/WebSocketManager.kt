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

/** raw handler for theme.push.* messages; carries the JSON-RPC request id for replies */

interface PushMessageHandler {
    fun onThemePushStart(requestId: Int, params: ThemePushStart)
    fun onThemePushChunk(requestId: Int, params: ThemePushChunk)
    fun onThemePushComplete(requestId: Int, params: ThemePushComplete)
    fun onThemePushCancel(requestId: Int, params: ThemePushCancel)
    fun onThemePushError(requestId: Int, params: ThemePushError)
}

/** push receive state listener, registered on the ViewModel to drive the progress dialog */
interface PushReceiveListener {
    fun onPushStart(state: ReceiveState)
    fun onPushProgress(state: ReceiveState)
    fun onPushComplete(state: ReceiveState)
    fun onPushCancelled(state: ReceiveState)
    fun onPushFailed(state: ReceiveState, error: String)
}

/**
 * OkHttp websocket client. url is ws://{ip}:{port} with no extra path; sends the JSON-RPC
 * handshake (with pairing code) right after connect and routes theme.push.* to [PushMessageHandler]
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
        private const val ERR_RATE_LIMITED = -32004
        private const val ERR_DEVICE_LIMIT = -32005
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

    // bumped on every connect(); callbacks from stale generations are dropped so an old
    // connection can't trigger a duplicate reconnect
    @Volatile
    private var connectionGeneration = 0L

    /** remote theme switch (theme.switch) from the PC */
    @Volatile
    var themeSwitchListener: ((themeId: String) -> Unit)? = null

    private val handshakePending = AtomicBoolean(false)

    private val handshakeTimeoutTask = Runnable {
        if (handshakePending.compareAndSet(true, false)) {
            Log.e(TAG, "Handshake timeout: no response in ${HANDSHAKE_TIMEOUT_MS / 1000}s")
            // cancel the underlying socket or a reconnect leaves two live connections
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

    /** connects and sends the handshake; url like ws://192.168.1.100:9527 */
    fun connect(url: String, pairingCode: String, deviceName: String, appVersion: String) {
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
                    // kick/ban errors (-32003/-32004) come without an id, intercept
                    // them or they just show as a generic disconnect
                    val errCode = message.error?.optInt("code", 0) ?: 0
                    if (errCode == ERR_DUPLICATE_CONNECTION || errCode == ERR_RATE_LIMITED) {
                        handshakePending.set(false)
                        mainHandler.removeCallbacks(handshakeTimeoutTask)
                        try {
                            webSocket.cancel()
                        } catch (_: Exception) {
                        }
                        listener.onConnectionFailed(
                            if (errCode == ERR_DUPLICATE_CONNECTION) ConnectionErrorType.DUPLICATE_CONNECTION
                            else ConnectionErrorType.UNKNOWN,
                            message.error?.optString("message")
                                ?: context.getString(R.string.duplicate_connection)
                        )
                        return
                    }
                    // no method = JSON-RPC response: id=1 is the handshake reply,
                    // the rest (media.get_current etc.) goes to the raw listener
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
                ERR_DEVICE_LIMIT -> ConnectionErrorType.DEVICE_LIMIT
                else -> ConnectionErrorType.UNKNOWN
            }
            if (handshakePending.compareAndSet(true, false)) {
                mainHandler.removeCallbacks(handshakeTimeoutTask)
                Log.e(TAG, "Handshake failed: ${result.errorMessage}")
                // device limit gets a localized message; other codes pass the
                // server's message straight through
                val message = if (type == ConnectionErrorType.DEVICE_LIMIT) {
                    context.getString(R.string.device_limit)
                } else {
                    result.errorMessage
                }
                listener.onConnectionFailed(type, message)
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

    /** sends a JSON-RPC message; returns false when there's no open socket so callers can react */
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

    fun sendResponse(responseJson: String): Boolean {
        return send(responseJson)
    }

    /** closes the connection, keeps the client around for reconnects */
    fun close() {
        expectedClose = true
        mainHandler.removeCallbacks(handshakeTimeoutTask)
        try {
            webSocket?.close(1000, "bye")
        } catch (_: Exception) {
        }
        webSocket = null
    }

    /** shuts down the client's executor, call from ViewModel onCleared */
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
