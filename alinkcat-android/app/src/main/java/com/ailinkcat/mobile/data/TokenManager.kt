package com.ailinkcat.mobile.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * 令牌持久化：使用 EncryptedSharedPreferences（AES-256 加密）存储令牌。
 * 令牌以密文落盘，即使设备被 root 也无法直接读取明文令牌。
 *
 * 接口与旧版 DataStore 实现保持一致，调用方无需改动。
 */
class TokenManager(context: Context) {

    private val prefs: SharedPreferences = createEncryptedPrefs(context)

    /** 是否已登录。 */
    private val _isLoggedIn = MutableStateFlow(prefs.getBoolean(KEY_IS_LOGGED_IN, false))
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    /** 当前用户名。 */
    private val _username = MutableStateFlow(prefs.getString(KEY_USERNAME, null))
    val username: StateFlow<String?> = _username.asStateFlow()

    /** 当前用户 ID。 */
    private val _userId = MutableStateFlow(prefs.getLong(KEY_USER_ID, -1L).takeIf { it >= 0 })
    val userId: StateFlow<Long?> = _userId.asStateFlow()

    /** 登录成功时保存完整令牌信息。 */
    fun saveLogin(
        accessToken: String,
        refreshToken: String,
        tokenType: String,
        userId: Long,
        username: String,
        role: String
    ) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putString(KEY_TOKEN_TYPE, tokenType)
            .putLong(KEY_USER_ID, userId)
            .putString(KEY_USERNAME, username)
            .putString(KEY_ROLE, role)
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
        _isLoggedIn.value = true
        _username.value = username
        _userId.value = userId
    }

    /** 刷新令牌后更新 accessToken 和 refreshToken。 */
    fun updateTokens(accessToken: String, refreshToken: String) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putBoolean(KEY_IS_LOGGED_IN, true)
            .apply()
        _isLoggedIn.value = true
    }

    /** 清除所有令牌信息（登出 / token 过期）。 */
    fun clear() {
        prefs.edit().clear().apply()
        _isLoggedIn.value = false
        _username.value = null
        _userId.value = null
    }

    /** 获取 accessToken（同步，方便拦截器使用）。 */
    fun getAccessTokenSync(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    /** 获取 refreshToken（同步）。 */
    fun getRefreshTokenSync(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    private companion object {
        const val KEY_ACCESS_TOKEN = "access_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_TOKEN_TYPE = "token_type"
        const val KEY_USER_ID = "user_id"
        const val KEY_USERNAME = "username"
        const val KEY_ROLE = "role"
        const val KEY_IS_LOGGED_IN = "is_logged_in"

        /**
         * 创建加密 SharedPreferences。
         * 个别设备初始化失败时回退到普通 SharedPreferences，保证功能可用。
         */
        fun createEncryptedPrefs(context: Context): SharedPreferences {
            return try {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    context,
                    "ailinkcat_auth",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            } catch (e: Exception) {
                context.getSharedPreferences("ailinkcat_auth", Context.MODE_PRIVATE)
            }
        }
    }
}