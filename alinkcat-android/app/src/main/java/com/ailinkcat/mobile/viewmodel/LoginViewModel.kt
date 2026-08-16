package com.ailinkcat.mobile.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.ailinkcat.mobile.R
import com.ailinkcat.mobile.data.AuthApi
import com.ailinkcat.mobile.data.DeviceInfoProvider
import com.ailinkcat.mobile.data.TokenManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 登录页状态。
 */
data class LoginUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    /** code: 429 限流时，剩余锁定秒数（倒计时）。 */
    val lockSeconds: Int = 0,
    val isLoginSuccess: Boolean = false,
    val username: String = "",
    val password: String = ""
)

/**
 * 登录页 ViewModel：处理登录、表单验证、429 限流倒计时。
 */
class LoginViewModel(application: Application) : AndroidViewModel(application) {

    private val tokenManager = TokenManager(application)
    private val deviceInfoProvider = DeviceInfoProvider(application)
    private val deviceInfo = deviceInfoProvider.collect()

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private var lockCountdownJob: Job? = null

    /** 更新表单中的用户名。 */
    fun updateUsername(value: String) {
        _uiState.value = _uiState.value.copy(username = value, errorMessage = null)
    }

    /** 更新表单中的密码。 */
    fun updatePassword(value: String) {
        _uiState.value = _uiState.value.copy(password = value, errorMessage = null)
    }

    /** 清除错误信息。 */
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    /**
     * 执行登录。
     *
     * 处理流程：
     * 1. 表单非空校验
     * 2. 调用 AuthApi.login()
     * 3. 成功 → 保存令牌 → 回调 onLoginSuccess
     * 4. 失败 → 显示错误 / 429 限流启动倒计时
     */
    fun login(onLoginSuccess: () -> Unit) {
        val state = _uiState.value
        val app = getApplication<Application>()

        // 表单校验
        if (state.username.isBlank()) {
            _uiState.value = state.copy(errorMessage = app.getString(R.string.enter_username))
            return
        }
        if (state.password.isBlank()) {
            _uiState.value = state.copy(errorMessage = app.getString(R.string.enter_password))
            return
        }

        // 正在请求中
        _uiState.value = state.copy(isLoading = true, errorMessage = null)

        viewModelScope.launch {
            val result = AuthApi.login(
                username = state.username.trim(),
                password = state.password,
                deviceInfo = deviceInfo
            )

            if (result.success && result.data != null) {
                // 保存令牌
                tokenManager.saveLogin(
                    accessToken = result.data.accessToken,
                    refreshToken = result.data.refreshToken,
                    tokenType = result.data.tokenType,
                    userId = result.data.userId,
                    username = result.data.username,
                    role = result.data.role
                )
                _uiState.value = _uiState.value.copy(isLoading = false, isLoginSuccess = true)
                onLoginSuccess()
            } else {
                if (result.code == 429) {
                    // 限流：启动 15 分钟倒计时
                    startLockCountdown(15 * 60)
                }
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = result.message
                )
            }
        }
    }

    /** 登出：清除令牌并调用服务端登出接口。 */
    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            val token = tokenManager.getAccessTokenSync()
            if (token != null) {
                AuthApi.logout(token)
            }
            tokenManager.clear()
            onLoggedOut()
        }
    }

    /** 刷新令牌（应用启动时 / 接口返回 401 时调用）。 */
    suspend fun tryRefreshToken(): Boolean {
        val refreshToken = tokenManager.getRefreshTokenSync() ?: return false
        val result = AuthApi.refresh(refreshToken)
        if (result.success && result.data != null) {
            tokenManager.updateTokens(result.data.accessToken, result.data.refreshToken)
            return true
        }
        return false
    }

    /** 检查是否已登录（用于启动页判断跳转）。 */
    fun isLoggedIn(onResult: (Boolean) -> Unit) {
        viewModelScope.launch {
            tokenManager.isLoggedIn.collect { loggedIn ->
                onResult(loggedIn)
                return@collect
            }
        }
    }

    /** 获取当前 accessToken。 */
    fun getAccessToken(): String? = tokenManager.getAccessTokenSync()

    /**
     * 429 限流倒计时：每秒更新一次剩余秒数，归零后自动清除。
     */
    private fun startLockCountdown(totalSeconds: Int) {
        lockCountdownJob?.cancel()
        _uiState.value = _uiState.value.copy(lockSeconds = totalSeconds)

        lockCountdownJob = viewModelScope.launch {
            var remaining = totalSeconds
            while (remaining > 0) {
                delay(1000)
                remaining--
                _uiState.value = _uiState.value.copy(lockSeconds = remaining)
            }
            // 倒计时结束，清除锁定状态并允许用户重试
            _uiState.value = _uiState.value.copy(lockSeconds = 0, errorMessage = null)
        }
    }

    override fun onCleared() {
        lockCountdownJob?.cancel()
        super.onCleared()
    }
}
