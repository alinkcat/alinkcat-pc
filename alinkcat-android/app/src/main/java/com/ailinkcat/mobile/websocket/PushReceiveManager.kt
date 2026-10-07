package com.ailinkcat.mobile.websocket

import android.content.Context
import android.util.Base64
import android.util.Log
import com.ailinkcat.mobile.R
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.FileOutputStream

/**
 * theme pack push receive: start -> user confirm (auto-reject after 10s) -> per-chunk ack ->
 * sha-256 verify + unzip -> reply. chunks land in cache/push_temp/{themeId}.alc.part and a
 * dropped connection keeps the .part for resume. messages arrive on the OkHttp read thread.
 */
class PushReceiveManager(context: Context) : PushMessageHandler {

    private val repository = ThemeRepository(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val appContext = context.applicationContext

    private val _state = MutableStateFlow<ReceiveState?>(null)
    val receiveState: StateFlow<ReceiveState?> = _state.asStateFlow()

    /** ui listener, registered by PushReceiveViewModel */
    @Volatile
    var listener: PushReceiveListener? = null

    /** response sender, bound to the websocket by ConnectionViewModel */
    @Volatile
    private var responseSender: ((String) -> Unit)? = null

    private var outputStream: FileOutputStream? = null
    private var expectedHash = ""
    private var pendingStartId = -1
    private var pendingStartParams: ThemePushStart? = null
    // request id of the last chunk, cancel is acked against it so the PC side can match
    private var lastChunkRequestId = -1
    private var lastUpdateAt = 0L
    private var lastUpdateBytes = 0L

    // receive watchdog: interrupt when no chunks arrive while RECEIVING (keeps the .part)
    private var watchdogJob: Job? = null

    companion object {
        private const val TAG = "PushReceiveManager"
        private const val ERR_PUSH_REJECTED = -32020
        private const val ERR_PUSH_FAILED = -32021
        private const val ERR_CHUNK_WRITE_FAILED = -32030
        private const val ERR_INVALID_PARAMS = -32602
        private const val WATCHDOG_TIMEOUT_MS = 30_000L
    }

    init {
        scope.launch { repository.cleanupStaleTempFiles() }
    }

    fun setResponseSender(sender: (String) -> Unit) {
        responseSender = sender
    }

    @Synchronized
    override fun onThemePushStart(requestId: Int, params: ThemePushStart) {
        // only receiving / awaiting confirm count as busy; a leftover INTERRUPTED
        // state can be taken over by a new push (overwrite rebuilds the temp file)
        val cur = _state.value
        if (cur != null && cur.status != ReceiveStatus.IDLE
            && cur.status != ReceiveStatus.COMPLETED
            && cur.status != ReceiveStatus.CANCELLED
            && cur.status != ReceiveStatus.FAILED
            && cur.status != ReceiveStatus.INTERRUPTED
        ) {
            Log.d(TAG, "Busy: replying busy for ${params.themeId}")
            sendBusyResponse(requestId)
            return
        }

        if (params.size <= 0 || params.totalChunks <= 0) {
            Log.e(TAG, "Invalid push params for ${params.themeId}")
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Invalid push params")
            failAtStart(params, appContext.getString(R.string.invalid_push_data))
            return
        }

        // storage check before accepting, 1.5x headroom for unzip
        val tempFile = repository.tempFile(params.themeId)
        val storageDir = tempFile.parentFile ?: tempFile
        if (!FileUtils.hasEnoughSpace(storageDir, params.size)) {
            Log.e(TAG, "Insufficient storage for ${params.themeId}")
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Insufficient storage")
            failAtStart(params, appContext.getString(R.string.insufficient_storage))
            return
        }

        // leftover .part from an interrupted transfer, offer resume
        val isResume = tempFile.exists() && tempFile.length() > 0
        val interrupted = _state.value?.takeIf {
            it.status == ReceiveStatus.INTERRUPTED && it.themeId == params.themeId
        }

        pendingStartId = requestId
        pendingStartParams = params
        expectedHash = params.hash
        lastChunkRequestId = -1

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
        // 10s auto-reject is handled by the ViewModel
        listener?.onPushStart(state)
    }

    /**
     * reply ready and start receiving. any leftover .part is overwritten from scratch to
     * match the PC side's full retransmit protocol; chunk-level resume would misalign data
     */
    @Synchronized
    fun acceptPending() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.PENDING_CONFIRM) return
        val params = pendingStartParams ?: return
        Log.d(TAG, "User accepted push of ${params.themeId}")

        val tempFile = repository.tempFile(params.themeId)
        val storageDir = tempFile.parentFile ?: tempFile
        if (!FileUtils.hasEnoughSpace(storageDir, params.size)) {
            sendErrorResponse(pendingStartId, ERR_INVALID_PARAMS, "Insufficient storage")
            abortPending(st.copy(errorMessage = appContext.getString(R.string.insufficient_storage)))
            return
        }

        try {
            outputStream?.close()
            // overwrite mode, ignore any leftover .part
            outputStream = FileOutputStream(tempFile, false)
        } catch (e: Exception) {
            Log.e(TAG, "Cannot create temp file: ${e.message}")
            sendErrorResponse(pendingStartId, ERR_INVALID_PARAMS, "Cannot create temp file")
            abortPending(st.copy(errorMessage = appContext.getString(R.string.cannot_create_temp_file, e.message ?: "")))
            return
        }

        // ready reply tells the PC to start sending chunks
        sendReadyResponse(pendingStartId, params.themeId)

        lastUpdateAt = System.currentTimeMillis()
        lastUpdateBytes = 0

        val state = st.copy(
            status = ReceiveStatus.RECEIVING,
            receivedSize = 0,
            receivedChunks = 0,
            progress = 0f,
            speed = 0f
        )
        _state.value = state
        resetWatchdog(st.themeId)
        listener?.onPushProgress(state)
    }

    /** user rejected or 10s timeout: reply rejected (-32020) and clean up */
    @Synchronized
    fun rejectPending() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.PENDING_CONFIRM) return
        Log.d(TAG, "User rejected push of ${st.themeId}")
        sendRejectResponse(pendingStartId)
        lastChunkRequestId = -1
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
        if (st.themeId != params.themeId || st.status != ReceiveStatus.RECEIVING) {
            // state mismatch (e.g. PC skipped the handshake): reply or it waits for an ack forever
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Not receiving")
            return
        }
        lastChunkRequestId = requestId
        val out = outputStream ?: return

        val bytes = try {
            Base64.decode(params.data, Base64.DEFAULT)
        } catch (_: Exception) {
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Invalid chunk data")
            return
        }
        if (bytes.isEmpty()) {
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Empty chunk data")
            return
        }

        // lower index = duplicate after a lost ack, re-ack idempotently;
        // higher index = gap, error so the PC restarts the transfer
        if (params.chunkIndex < st.receivedChunks) {
            sendChunkAckResponse(requestId, params.chunkIndex)
            return
        }
        if (params.chunkIndex > st.receivedChunks) {
            sendErrorResponse(requestId, ERR_INVALID_PARAMS, "Chunk gap at ${st.receivedChunks}")
            return
        }

        try {
            out.write(bytes)
            out.flush()
        } catch (e: Exception) {
            Log.e(TAG, "Write failed for chunk ${params.chunkIndex}: ${e.message}")
            failCurrent(appContext.getString(R.string.disk_write_failed, e.message ?: "disk full"), requestId)
            return
        }

        val received = st.receivedSize + bytes.size
        if (received > st.totalSize) {
            failCurrent(appContext.getString(R.string.data_size_error), requestId)
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
        resetWatchdog(st.themeId)
        sendChunkAckResponse(requestId, params.chunkIndex)
        listener?.onPushProgress(state)
    }

    @Synchronized
    override fun onThemePushComplete(requestId: Int, params: ThemePushComplete) {
        val st = _state.value
        if (st == null) {
            // must reply or the PC treats the push as successful
            sendErrorResponse(requestId, ERR_PUSH_FAILED, "Not receiving any theme")
            return
        }
        if (st.themeId != params.themeId) {
            sendErrorResponse(requestId, ERR_PUSH_FAILED, "Theme mismatch")
            return
        }
        if (st.status == ReceiveStatus.COMPLETED) {
            // duplicate complete, ack success idempotently
            sendCompleteResponse(requestId, "success", st.themeId)
            return
        }
        if (st.status != ReceiveStatus.RECEIVING) {
            // interrupted/cancelled still needs a reply, silence reads as success on the PC
            sendErrorResponse(requestId, ERR_PUSH_FAILED, appContext.getString(R.string.status_interrupted))
            return
        }
        if (params.status != "success") {
            failCurrent(appContext.getString(R.string.transfer_status_error, params.status), requestId)
            return
        }
        cancelWatchdog()
        closeStream()
        val tempFile = repository.tempFile(params.themeId)
        // snapshot shared fields, finalize runs on the IO thread and would race with the read thread
        val snapshotHash = expectedHash
        val snapshotStartId = pendingStartId
        pendingStartId = -1
        pendingStartParams = null
        scope.launch {
            val result = finalizeReceive(st, tempFile, requestId, snapshotHash, snapshotStartId)
            _state.value = result
            when (result.status) {
                ReceiveStatus.COMPLETED -> listener?.onPushComplete(result)
                ReceiveStatus.FAILED ->
                    listener?.onPushFailed(result, result.errorMessage ?: appContext.getString(R.string.receive_failed))
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
        failCurrent(appContext.getString(R.string.push_error_format, params.code, params.message), requestId)
    }

    /** user cancel while receiving: reject (-32020), delete the temp file, mark cancelled */
    @Synchronized
    fun cancelReceive() {
        val st = _state.value ?: return
        if (st.status != ReceiveStatus.RECEIVING) return
        Log.d(TAG, "User cancelled receive of ${st.themeId}")
        cancelWatchdog()
        // ack against the last chunk's request id, that's what the PC is waiting on, not start
        sendRejectResponse(if (lastChunkRequestId >= 0) lastChunkRequestId else pendingStartId)
        lastChunkRequestId = -1
        pendingStartId = -1
        pendingStartParams = null
        closeStream()
        cleanup(st.themeId)
        val state = st.copy(status = ReceiveStatus.CANCELLED)
        _state.value = state
        listener?.onPushCancelled(state)
    }

    /** connection lost: keep the .part, mark INTERRUPTED and wait for a re-push */
    @Synchronized
    fun handleConnectionLost() {
        val st = _state.value ?: return
        if (st.status == ReceiveStatus.RECEIVING) {
            Log.d(TAG, "Connection lost during receive of ${st.themeId}, keeping .part")
            cancelWatchdog()
            closeStream()
            pendingStartId = -1
            pendingStartParams = null
            val state = st.copy(
                status = ReceiveStatus.INTERRUPTED,
                errorMessage = appContext.getString(R.string.status_interrupted)
            )
            _state.value = state
            listener?.onPushProgress(state)
        } else if (st.status == ReceiveStatus.PENDING_CONFIRM) {
            // lost while awaiting confirm: back to IDLE so the UI dismisses the dialog
            Log.d(TAG, "Connection lost while awaiting confirm of ${st.themeId}")
            pendingStartId = -1
            pendingStartParams = null
            closeStream()
            val state = st.copy(status = ReceiveStatus.IDLE)
            _state.value = state
            listener?.onPushCancelled(state)
        }
    }

    /** whether an unfinished transfer exists, for the "resume?" prompt */
    fun hasInterruptedTransfer(): Boolean {
        return _state.value?.status == ReceiveStatus.INTERRUPTED ||
            repository.getTempDir().listFiles()?.any { it.exists() && it.length() > 0 } == true
    }

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
        listener?.onPushFailed(failed, failed.errorMessage ?: appContext.getString(R.string.receive_failed))
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

    /** watchdog: mark INTERRUPTED if no chunk arrives in time, keeps the .part; rearmed per chunk */
    private fun resetWatchdog(themeId: String) {
        watchdogJob?.cancel()
        watchdogJob = scope.launch {
            delay(WATCHDOG_TIMEOUT_MS)
            val cur = _state.value
            if (cur?.status == ReceiveStatus.RECEIVING && cur.themeId == themeId) {
                Log.w(TAG, "No chunk received for ${WATCHDOG_TIMEOUT_MS}ms, interrupting")
                closeStream()
                pendingStartId = -1
                pendingStartParams = null
                val state = cur.copy(
                    status = ReceiveStatus.INTERRUPTED,
                    errorMessage = appContext.getString(R.string.status_interrupted)
                )
                _state.value = state
                listener?.onPushProgress(state)
            }
        }
    }

    private fun cancelWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
    }

    private fun failCurrent(message: String, errorId: Int? = null) {
        val st = _state.value ?: return
        Log.e(TAG, "Receive failed: $message")
        cancelWatchdog()
        closeStream()
        cleanup(st.themeId)
        // reply on the current request's id (start/chunk/complete) so the PC AckBus can match it
        if (errorId != null && errorId >= 0) {
            sendErrorResponse(errorId, ERR_PUSH_FAILED, message)
        }
        pendingStartId = -1
        pendingStartParams = null
        val state = st.copy(status = ReceiveStatus.FAILED, errorMessage = message)
        _state.value = state
        listener?.onPushFailed(state, message)
    }

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

    /** finalize: sha-256 verify -> unzip -> save meta -> delete temp -> reply; reply error on
     *  failure so the PC doesn't show a fake success */
    private fun finalizeReceive(st: ReceiveState, tempFile: java.io.File, requestId: Int, expectedHash: String, startId: Int): ReceiveState {
        val actualHash = FileUtils.sha256(tempFile)
        if (actualHash == null) {
            cleanup(st.themeId)
            sendErrorResponse(requestId, ERR_PUSH_FAILED, appContext.getString(R.string.hash_verify_failed))
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = appContext.getString(R.string.hash_verify_failed))
        }
        if (expectedHash.isNotBlank() && !actualHash.equals(expectedHash, ignoreCase = true)) {
            cleanup(st.themeId)
            sendErrorResponse(requestId, ERR_PUSH_FAILED, appContext.getString(R.string.hash_mismatch))
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = appContext.getString(R.string.hash_mismatch))
        }

        // unzip into the theme dir
        val destDir = repository.themeDir(st.themeId)
        if (!FileUtils.unzipTo(tempFile, destDir)) {
            cleanup(st.themeId)
            repository.deleteTheme(st.themeId)
            sendErrorResponse(requestId, ERR_PUSH_FAILED, appContext.getString(R.string.unzip_failed))
            return st.copy(status = ReceiveStatus.FAILED, errorMessage = appContext.getString(R.string.unzip_failed))
        }

        // save meta, read theme.json for the real page count and cover
        val pageCount = try {
            val themeFile = repository.themeFile(st.themeId)
            if (themeFile.exists()) {
                val themeJson = JSONObject(themeFile.readText())
                themeJson.optJSONArray("pages")?.length() ?: 1
            } else 1
        } catch (_: Exception) { 1 }
        val coverUrl = try {
            val coverFile = repository.getCoverFile(st.themeId)
            if (coverFile.exists()) coverFile.toURI().toString() else null
        } catch (_: Exception) { null }
        repository.saveMeta(
            ThemeMeta(
                themeId = st.themeId,
                name = st.themeName,
                version = st.version,
                hash = expectedHash,
                receivedAt = System.currentTimeMillis(),
                pageCount = pageCount,
                coverUrl = coverUrl
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
        lastChunkRequestId = -1
    }
}
