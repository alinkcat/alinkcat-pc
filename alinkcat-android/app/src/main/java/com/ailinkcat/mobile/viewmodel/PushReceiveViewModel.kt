package com.ailinkcat.mobile.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.ailinkcat.mobile.R
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

/** registers as PushReceiveListener and drives the confirm/progress dialogs, snackbars and auto-close.
 *  IDLE -> PENDING_CONFIRM (10s auto-reject) -> RECEIVING (progress dialog)
 *  -> COMPLETED / CANCELLED / FAILED / INTERRUPTED */
class PushReceiveViewModel(
    application: Application,
    private val manager: PushReceiveManager,
    private val onPushCompleted: () -> Unit
) : AndroidViewModel(application), PushReceiveListener {

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

        // 10s auto-reject while awaiting confirm
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
            showSnackbar(getApplication<Application>().getString(R.string.push_receive_success))
            autoClose()
        }
    }

    override fun onPushCancelled(state: ReceiveState) {
        confirmTimeoutJob?.cancel()
        val wasConfirming = _state.value?.status == ReceiveStatus.PENDING_CONFIRM
        _state.value = state
        val app = getApplication<Application>()
        showSnackbar(if (wasConfirming) app.getString(R.string.push_rejected) else app.getString(R.string.push_cancelled))
        if (wasConfirming) {
            // rejected during confirm, close the dialog right away
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

    /** user tapped accept: reply ready and start receiving */
    fun acceptReceive() {
        confirmTimeoutJob?.cancel()
        manager.acceptPending()
    }

    /** user tapped reject / 10s timeout: reply rejected (-32020) */
    fun rejectReceive() {
        confirmTimeoutJob?.cancel()
        manager.rejectPending()
    }

    /** cancel while receiving: reject and clean up temp files */
    fun cancelReceive() {
        manager.cancelReceive()
    }

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

    /** auto-close the dialog 3s after a terminal state, except when interrupted */
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
            initializer {
                val app = this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
                    as Application
                PushReceiveViewModel(app, manager, onPushCompleted)
            }
        }
    }
}
