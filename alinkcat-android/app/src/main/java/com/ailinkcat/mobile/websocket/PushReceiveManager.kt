package com.ailinkcat.mobile.websocket

import android.content.Context
import android.util.Base64
import android.util.Log
import com.ailinkcat.mobile.data.JsonRpc
import com.ailinkcat.mobile.domain.repository.ThemeRepository
import com.ailinkcat.mobile.utils.FileUtils
import com.ailinkcat.mobile.websocket.models.ReceiveState
import com.ailinkcat.mobile.websocket.models.ReceiveStatus
import com.ailinkcat.mobile.websocket.models.ThemeMeta
import com.ailinkcat.mobile.websocket.models.ThemePushCancel
import com.ailinkcat.mobile.websocket.models.ThemePushChunk
import com.ailinkcat.mobile.websocket.models.ThemePushComplete
import com.ailinkcat.mobile.websocket.models.ThemePushError
import com.ailinkcat.mobile.websocket.models.ThemePushStart
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.FileOutputStream

/**
 * 推送接收管理器：负责主题包推送接收全流程。
 *
 * 流程：收到 theme.push.start -> 询问用户 -> 接收 -> 逐块回执 -> 校验/解压 -> 回复结果
 * - 收到 start 后先弹窗询问用户（PENDING_CONFIRM），10 秒无操作自动拒绝
 * - 用户确认后回复 ready 并开始接收；拒绝则回复 rejected（-32020）
 * - 每个 chunk 写入完成后回复 ok（-32030 写入失败）
 * - 数据块写入临时文件 cache/push_temp/{themeId}.alc.part
 * - 连接中断保留 .part 文件，下次 start 时提示断点续传
 * - SHA-256 完整性校验，成功回复 success，失败回复 failed 并清理
 * - 接收前检查存储空间（主题包大小 × 1.5，预留解压空间）
 *
 * 消息到达线程为 OkHttp 读取线程（单线程顺序），状态变更通过 StateFlow 暴露。
 */
class PushReceiveManager(context: Context) : PushMessageHandler {

    private val repository = ThemeRepository(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _state = MutableStateFlow<ReceiveState?>(null)
    val receiveState: StateFlow<ReceiveState?> = _state.asStateFlow()

    /** UI 监听器（由 PushReceiveViewModel 注册）。 */
    @Volatile
    var listener: PushReceiveListener? = null

    /** 响应发送器（由 ConnectionViewModel 绑定到 WebSocket）。 */
    @Volatile
    private var responseSender: ((String) -> Unit)? = null

    private var outputStream: FileOutputStream? = null
    private var expectedHash = ""
    private var pendingStartId = -1
    private var pendingStartParams: ThemePushStart? = null
    private var lastUpdateAt = 0L
    private var lastUpdateBytes = 0L

    companion object {
        private const val TAG = "PushReceiveManager"
        private const val ERR_PUSH_REJECTED = -32020
        private const val ERR_PUSH_FAILED = -32021
        private const val ERR_CHUNK_WRITE_FAILED = -32030
        private const val ERR_INVALID_PARAMS = -32602
    }

    init {
        // 应用启动时清理超过 24 小时的临时文件
        scope.launch { repository.cleanupStaleTempFiles() }
    }

    fun setResponseSender(sender: (String) -> Unit) {
        responseSender = sender
    }

    @Synchronized
    override fun onThemePushStart(requestId: Int, params: ThemePushStart) {
        // 忙碌：正在接收其他主题包，通知 PC 稍后重试
        if (_state.value?.status == ReceiveStatus.RECEIVING) {
            Log.d(TAG, "Busy: replying busy for ${params.themeId}")
            sendBusyResponse(requestId)
            return
        }

        if (params.size <= 0 || params.totalChunks <= 0) {
            Log.e(TAG, "Invalid push params for ${params.themeId}")
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Invalid push params")
            failAtStart(params, "推送数据无效")
            return
        }

        // 接收前检查存储空间（预留 1.5 倍供解压）
        val tempFile = repository.tempFile(params.themeId)
        val storageDir = tempFile.parentFile ?: tempFile
        if (!FileUtils.hasEnoughSpace(storageDir, params.size)) {
            Log.e(TAG, "Insufficient storage for ${params.themeId}")
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "存储空间不足，无法接收主题包")
            failAtStart(params, "存储空间不足，无法接收主题包")
            return
        }

        // 存在残留 .part 且此前被中断 -> 断点续传提示
        val isResume = tempFile.exists() && tempFile.length() > 0
        val interrupted = _state.value?.takeIf {
            it.status == ReceiveStatus.INTERRUPTED && it.themeId == params.themeId
        }

        pendingStartId = requestId
        pendingStartParams = params
        expectedHash = params.hash

        val state = ReceiveState(
            themeId = params.themeId,
            themeName = params.name,
            version = params.version,
            totalSize = params.size,
            receivedSize = if (isResume) tempFile.length() else 0L,
            totalChunks = params.totalChunks,
            receivedChunks = interrupted?.receivedChunks ?: 0,
            status = ReceiveStatus.PENDING_CONFIRM,
            isResume = isResume
        )
        _state.value = state
        // 询问用户：UI 弹出确认对话框（10 秒无操作自动拒绝由 ViewModel 控制）
        listener?.onPushStart(state)
    }

    /**
     * 用户点击“接收”：回复 ready 并开始接收（支持断点续传追加写入）。
     */
    @Synchronized
    fun acceptPending() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.PENDING_CONFIRM) return
        val params = pendingStartParams ?: return
        Log.d(TAG, "User accepted push of ${params.themeId}")

        // 再次检查存储空间
        val tempFile = repository.tempFile(params.themeId)
        val storageDir = tempFile.parentFile ?: tempFile
        if (!FileUtils.hasEnoughSpace(storageDir, params.size)) {
            sendErrorResponse(pendingStartId, ERR_INVALID_PARAMS, "存储空间不足，无法接收主题包")
            abortPending(st.copy(errorMessage = "存储空间不足，无法接收主题包"))
            return
        }

        try {
            outputStream?.close()
            // 断点续传：追加写入
            outputStream = FileOutputStream(tempFile, st.isResume)
        } catch (e: Exception) {
            Log.e(TAG, "Cannot create temp file: ${e.message}")
            sendErrorResponse(pendingStartId, ERR_INVALID_PARAMS, "Cannot create temp file")
            abortPending(st.copy(errorMessage = "无法创建临时文件：${e.message}"))
            return
        }

        // 回复 ready，PC 端开始发送数据块
        sendReadyResponse(pendingStartId, params.themeId)

        lastUpdateAt = System.currentTimeMillis()
        lastUpdateBytes = st.receivedSize

        val state = st.copy(
            status = ReceiveStatus.RECEIVING,
            progress = if (st.totalSize > 0) st.receivedSize.toFloat() / st.totalSize else 0f
        )
        _state.value = state
        listener?.onPushProgress(state)
    }

    /**
     * 用户拒绝 / 10 秒超时：回复 rejected（-32020）并清理。
     */
    @Synchronized
    fun rejectPending() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.PENDING_CONFIRM) return
        Log.d(TAG, "User rejected push of ${st.themeId}")
        sendRejectResponse(pendingStartId)
        pendingStartId = -1
        pendingStartParams = null
        closeStream()
        cleanup(st.themeId)
        val state = st.copy(status = ReceiveStatus.CANCELLED)
        _state.value = state
        listener?.onPushCancelled(state)
    }

    @Synchronized
    override fun onThemePushChunk(requestId: Int, params: ThemePushChunk) {
        val st = _state.value ?: return
        if (st.themeId != params.themeId || st.status != ReceiveStatus.RECEIVING) return
        val out = outputStream ?: return

        val bytes = try {
            Base64.decode(params.data, Base64.DEFAULT)
        } catch (_: Exception) {
            return
        }
        if (bytes.isEmpty()) return

        try {
            out.write(bytes)
            out.flush()
        } catch (e: Exception) {
            Log.e(TAG, "Write failed for chunk ${params.chunkIndex}: ${e.message}")
            sendChunkErrorResponse(requestId, params.chunkIndex, e.message ?: "disk full")
            return
        }

        val received = st.receivedSize + bytes.size
        if (received > st.totalSize) {
            failCurrent("数据大小异常，接收已中止")
            return
        }
        val chunks = st.receivedChunks + 1

        val now = System.currentTimeMillis()
        var speed = st.speed
        if (now - lastUpdateAt >= 200) {
            speed = (received - lastUpdateBytes) * 1000f / (now - lastUpdateAt)
            lastUpdateAt = now
            lastUpdateBytes = received
        }

        val state = st.copy(
            receivedSize = received,
            receivedChunks = chunks,
            progress = if (st.totalSize > 0) received.toFloat() / st.totalSize else 0f,
            speed = speed / 1024f
        )
        _state.value = state
        // 每个 chunk 写入完成后发送确认
        sendChunkAckResponse(requestId, params.chunkIndex)
        listener?.onPushProgress(state)
    }

    @Synchronized
    override fun onThemePushComplete(requestId: Int, params: ThemePushComplete) {
        val st = _state.value ?: return
        if (st.themeId != params.themeId || st.status != ReceiveStatus.RECEIVING) return
        if (params.status != "success") {
            failCurrent("传输状态异常：${params.status}")
            return
        }
        closeStream()
        val tempFile = repository.tempFile(params.themeId)
        scope.launch {
            val result = finalizeReceive(st, tempFile, requestId)
            _state.value = result
            when (result.status) {
                ReceiveStatus.COMPLETED -> listener?.onPushComplete(result)
                ReceiveStatus.FAILED ->
                    listener?.onPushFailed(result, result.errorMessage ?: "接收失败")
                else -> Unit
            }
        }
    }

    @Synchronized
    override fun onThemePushCancel(requestId: Int, params: ThemePushCancel) {
        val st = _state.value ?: return
        if (st.themeId != params.themeId) return
        when (st.status) {
            ReceiveStatus.RECEIVING -> cancelReceive()
            ReceiveStatus.PENDING_CONFIRM -> rejectPending()
            else -> Unit
        }
    }

    @Synchronized
    override fun onThemePushError(requestId: Int, params: ThemePushError) {
        val st = _state.value ?: return
        if (st.themeId != params.themeId || st.status != ReceiveStatus.RECEIVING) return
        failCurrent("推送错误（${params.code}）：${params.message}")
    }

    /**
     * 用户取消/拒绝接收（接收中）：向 PC 发送拒绝消息（-32020）、删除临时文件并置为已取消。
     */
    @Synchronized
    fun cancelReceive() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.RECEIVING) return
        Log.d(TAG, "User cancelled receive of ${st.themeId}")
        sendRejectResponse(pendingStartId)
        pendingStartId = -1
        pendingStartParams = null
        closeStream()
        cleanup(st.themeId)
        val state = st.copy(status = ReceiveStatus.CANCELLED)
        _state.value = state
        listener?.onPushCancelled(state)
    }

    /**
     * 连接断开（中断）：保留 .part 文件，置为 INTERRUPTED，等待恢复。
     */
    @Synchronized
    fun handleConnectionLost() {
        val st = _state.value ?: return
        if (st.status == ReceiveStatus.RECEIVING) {
            Log.d(TAG, "Connection lost during receive of ${st.themeId}, keeping .part for resume")
            closeStream()
            pendingStartId = -1
            pendingStartParams = null
            val state = st.copy(
                status = ReceiveStatus.INTERRUPTED,
                errorMessage = "传输中断，等待恢复…"
            )
            _state.value = state
            listener?.onPushProgress(state)
        } else if (st.status == ReceiveStatus.PENDING_CONFIRM) {
            // 确认过程中断：清理待确认状态（10 秒超时逻辑由 ViewModel 处理）
            Log.d(TAG, "Connection lost while awaiting confirm of ${st.themeId}")
        }
    }

    /**
     * 是否存在未完成的传输（供“发现未完成的传输，是否继续？”检查）。
     */
    fun hasInterruptedTransfer(): Boolean {
        return _state.value?.status == ReceiveStatus.INTERRUPTED ||
            repository.getTempDir().listFiles()?.any { it.exists() && it.length() > 0 } == true
    }

    /**
     * 清理指定主题包的残留临时文件。
     */
    fun cleanup(themeId: String) {
        repository.deleteTempFile(themeId)
    }

    fun getReceiveState(themeId: String): ReceiveState? =
        _state.value?.takeIf { it.themeId == themeId }

    fun getInstalledThemes(): List<ThemeMeta> = repository.loadThemes()

    fun deleteInstalledTheme(themeId: String) {
        repository.deleteTheme(themeId)
    }

    private fun abortPending(state: ReceiveState) {
        val failed = state.copy(status = ReceiveStatus.FAILED)
        pendingStartId = -1
        pendingStartParams = null
        cleanup(failed.themeId)
        _state.value = failed
        listener?.onPushFailed(failed, failed.errorMessage ?: "接收失败")
    }

    private fun closeStream() {
        try {
            outputStream?.flush()
            outputStream?.close()
        } catch (_: Exception) {
        }
        outputStream = null
    }

    private fun failAtStart(params: ThemePushStart, message: String) {
        val state = ReceiveState(
            themeId = params.themeId,
            themeName = params.name,
            version = params.version,
            totalSize = params.size,
            totalChunks = params.totalChunks,
            status = ReceiveStatus.FAILED,
            errorMessage = message
        )
        _state.value = state
        listener?.onPushFailed(state, message)
    }

    private fun failCurrent(message: String) {
        val st = _state.value ?: return
        Log.e(TAG, "Receive failed: $message")
        closeStream()
        cleanup(st.themeId)
        sendErrorResponse(pendingStartId, ERR_PUSH_FAILED, message)
        pendingStartId = -1
        pendingStartParams = null
        val state = st.copy(status = ReceiveStatus.FAILED, errorMessage = message)
        _state.value = state
        listener?.onPushFailed(state, message)
    }

    // ─── 响应构建 ────────────────────────────────────────────

    private fun sendReadyResponse(id: Int, themeId: String) {
        responseSender?.invoke(
            JsonRpc.buildResponse(
                id,
                JSONObject()
                    .put("status", "ready")
                    .put("themeId", themeId)
            )
        )
    }

    private fun sendBusyResponse(id: Int) {
        responseSender?.invoke(
            JsonRpc.buildResponse(
                id,
                JSONObject()
                    .put("status", "busy")
                    .put("message", "Currently receiving another theme")
            )
        )
    }

    private fun sendRejectResponse(id: Int) {
        if (id < 0) return
        responseSender?.invoke(JsonRpc.buildErrorResponse(id, ERR_PUSH_REJECTED, "User rejected"))
    }

    private fun sendErrorResponse(id: Int, code: Int, message: String) {
        if (id < 0) return
        responseSender?.invoke(JsonRpc.buildErrorResponse(id, code, message))
    }

    private fun sendChunkAckResponse(id: Int, chunkIndex: Int) {
        if (id < 0) return
        responseSender?.invoke(
            JsonRpc.buildResponse(
                id,
                JSONObject()
                    .put("chunkIndex", chunkIndex)
                    .put("status", "ok")
            )
        )
    }

    private fun sendChunkErrorResponse(id: Int, chunkIndex: Int, reason: String) {
        if (id < 0) return
        responseSender?.invoke(
            JsonRpc.buildErrorResponse(
                id,
                ERR_CHUNK_WRITE_FAILED,
                "Write failed: $reason"
            )
        )
    }

    private fun sendCompleteResponse(id: Int, status: String, themeId: String) {
        if (id < 0) return
        responseSender?.invoke(
            JsonRpc.buildResponse(
                id,
                JSONObject()
                    .put("status", status)
                    .put("themeId", themeId)
            )
        )
    }

    /**
     * 完成阶段（IO 线程）：SHA-256 校验 -> 解压 -> 写入元数据 -> 删除临时文件 -> 回复结果。
     */
    private fun finalizeReceive(st: ReceiveState, tempFile: java.io.File, requestId: Int): ReceiveState {
        // SHA-256 校验
        val actualHash = FileUtils.sha256(tempFile)
        if (actualHash == null) {
            cleanup(st.themeId)
            sendCompleteResponse(requestId, "failed", st.themeId)
            resetPending()
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = "文件校验失败：无法计算哈希")
        }
        if (expectedHash.isNotBlank() && !actualHash.equals(expectedHash, ignoreCase = true)) {
            cleanup(st.themeId)
            sendCompleteResponse(requestId, "failed", st.themeId)
            resetPending()
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = "文件损坏：哈希校验不通过")
        }

        // 解压到主题目录
        val destDir = repository.themeDir(st.themeId)
        if (!FileUtils.unzipTo(tempFile, destDir)) {
            cleanup(st.themeId)
            repository.deleteTheme(st.themeId)
            sendCompleteResponse(requestId, "failed", st.themeId)
            resetPending()
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = "文件损坏：解压失败")
        }

        // 写入元数据
        repository.saveMeta(
            ThemeMeta(
                themeId = st.themeId,
                name = st.themeName,
                version = st.version,
                hash = expectedHash,
                receivedAt = System.currentTimeMillis()
            )
        )
        tempFile.delete()
        resetPending()
        sendCompleteResponse(requestId, "success", st.themeId)
        return st.copy(status = ReceiveStatus.COMPLETED, progress = 1f)
    }

    private fun resetPending() {
        pendingStartId = -1
        pendingStartParams = null
    }
}
