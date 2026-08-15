package com.ailinkcat.mobile.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.ailinkcat.mobile.websocket.PushReceiveListener
import com.ailinkcat.mobile.websocket.PushReceiveManager
import com.ailinkcat.mobile.websocket.models.ReceiveState
import com.ailinkcat.mobile.websocket.models.ReceiveStatus
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 推送接收状态管理：注册 PushReceiveListener，驱动确认/进度对话框、Snackbar 与自动关闭。
 *
 * 状态流转：
 *   IDLE -> (收到 theme.push.start) -> PENDING_CONFIRM（弹确认框，10 秒无操作自动拒绝）
 *        -> 用户"接收" -> 回复 ready -> RECEIVING（进度对话框）
 *        -> 用户"拒绝" -> 回复 rejected（-32020）-> CANCELLED
 *        -> RECEIVING -> COMPLETED / CANCELLED / FAILED / INTERRUPTED（连接中断，保留 .part）
 */
class PushReceiveViewModel(
    private val manager: PushReceiveManager,
    private val onPushCompleted: () -> Unit
) : ViewModel(), PushReceiveListener {

    private val _state = MutableStateFlow<ReceiveState?>(null)
    val state: StateFlow<ReceiveState?> = _state.asStateFlow()

    private val _dialogVisible = MutableStateFlow(false)
    val dialogVisible: StateFlow<Boolean> = _dialogVisible.asStateFlow()

    private val _snackbarMessage = MutableStateFlow<String?>(null)
    val snackbarMessage: StateFlow<String?> = _snackbarMessage.asStateFlow()

    private var confirmTimeoutJob: Job? = null
    private var autoCloseJob: Job? = null
    private var terminalHandled = false

    init {
        manager.listener = this
    }

    override fun onPushStart(state: ReceiveState) {
        confirmTimeoutJob?.cancel()
        autoCloseJob?.cancel()
        terminalHandled = false
        _state.value = state
        _dialogVisible.value = true

        // 确认阶段：10 秒无操作自动拒绝
        if (state.status == ReceiveStatus.PENDING_CONFIRM) {
            Log.d(TAG, "Awaiting user confirm for ${state.themeName} (10s timeout)")
            confirmTimeoutJob = viewModelScope.launch {
                delay(CONFIRM_TIMEOUT_MS)
                Log.d(TAG, "Confirm timeout, rejecting ${state.themeId}")
                manager.rejectPending()
            }
        }
    }

    override fun onPushProgress(state: ReceiveState) {
        confirmTimeoutJob?.cancel()
        _state.value = state
    }

    override fun onPushComplete(state: ReceiveState) {
        confirmTimeoutJob?.cancel()
        _state.value = state
        if (!terminalHandled) {
            terminalHandled = true
            onPushCompleted()
            showSnackbar("主题包接收成功！")
            autoClose()
        }
    }

    override fun onPushCancelled(state: ReceiveState) {
        confirmTimeoutJob?.cancel()
        val wasConfirming = _state.value?.status == ReceiveStatus.PENDING_CONFIRM
        _state.value = state
        showSnackbar(if (wasConfirming) "已拒绝接收" else "主题包接收已取消")
        if (wasConfirming) {
            // 确认阶段被拒绝：直接关闭确认对话框
            _dialogVisible.value = false
        } else {
            autoClose()
        }
    }

    override fun onPushFailed(state: ReceiveState, error: String) {
        confirmTimeoutJob?.cancel()
        _state.value = state
        showSnackbar(error)
        autoClose()
    }

    /** 用户点击"接收"：回复 ready 并开始接收。 */
    fun acceptReceive() {
        confirmTimeoutJob?.cancel()
        manager.acceptPending()
    }

    /** 用户点击"拒绝" / 10 秒超时：回复 rejected（-32020）。 */
    fun rejectReceive() {
        confirmTimeoutJob?.cancel()
        manager.rejectPending()
    }

    /** 接收中取消：发送拒绝消息并清理临时文件。 */
    fun cancelReceive() {
        manager.cancelReceive()
    }

    /** 用户点击"关闭"，立即隐藏对话框。 */
    fun dismiss() {
        confirmTimeoutJob?.cancel()
        autoCloseJob?.cancel()
        _dialogVisible.value = false
    }

    fun consumeSnackbar() {
        _snackbarMessage.value = null
    }

    private fun showSnackbar(message: String) {
        _snackbarMessage.value = message
    }

    /** 接收结束后 3 秒自动关闭对话框（中断状态不自动关闭）。 */
    private fun autoClose() {
        autoCloseJob?.cancel()
        autoCloseJob = viewModelScope.launch {
            delay(3000)
            _dialogVisible.value = false
        }
    }

    companion object {
        private const val TAG = "PushReceiveViewModel"
        private const val CONFIRM_TIMEOUT_MS = 10_000L

        fun factory(
            manager: PushReceiveManager,
            onPushCompleted: () -> Unit
        ): ViewModelProvider.Factory = viewModelFactory {
            initializer { PushReceiveViewModel(manager, onPushCompleted) }
        }
    }
}
