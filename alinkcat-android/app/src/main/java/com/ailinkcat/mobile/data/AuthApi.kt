package com.ailinkcat.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * 认证 API 服务：登录 / 刷新令牌 / 登出。
 *
 * TODO: 将 [BASE_URL] 抽取到配置中（如 DataStore 或 BuildConfig 字段）。
 */
object AuthApi {

    /** 后端服务基础地址，对接时替换为实际地址。 */
    var BASE_URL: String = "https://top.atqx.cn"

    private const val TAG = "AuthApi"

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    /**
     * 登录请求结果。
     */
    data class LoginResult(
        val success: Boolean,
        val code: Int,
        val message: String,
        val data: LoginData? = null
    )

    data class LoginData(
        val accessToken: String,
        val refreshToken: String,
        val tokenType: String,
        val userId: Long,
        val username: String,
        val role: String
    )

    /**
     * 用户登录。
     *
     * @param username 用户名
     * @param password 密码
     * @param deviceInfo 设备信息（全部字段必填）
     */
    suspend fun login(username: String, password: String, deviceInfo: DeviceInfo): LoginResult {
        return withContext(Dispatchers.IO) {
            try {
                val bodyJson = JSONObject().apply {
                    put("username", username)
                    put("password", password)
                    put("deviceCode", deviceInfo.deviceCode)
                    put("deviceName", deviceInfo.deviceName)
                    put("deviceType", deviceInfo.deviceType)
                    put("osVersion", deviceInfo.osVersion)
                    put("appVersion", deviceInfo.appVersion)
                }

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/login")
                    .post(bodyJson.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                parseResponse(body)
            } catch (e: Exception) {
                LoginResult(
                    success = false,
                    code = -1,
                    message = "Network connection failed: ${e.localizedMessage ?: "Unknown error"}"
                )
            }
        }
    }

    /**
     * 刷新令牌。
     *
     * @param refreshToken 当前 refreshToken
     */
    suspend fun refresh(refreshToken: String): LoginResult {
        return withContext(Dispatchers.IO) {
            try {
                val bodyJson = JSONObject().apply {
                    put("refreshToken", refreshToken)
                }

                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/refresh")
                    .post(bodyJson.toString().toRequestBody(JSON_MEDIA_TYPE))
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                parseResponse(body)
            } catch (e: Exception) {
                LoginResult(
                    success = false,
                    code = -1,
                    message = "Network connection failed: ${e.localizedMessage ?: "Unknown error"}"
                )
            }
        }
    }

    /**
     * 用户登出。
     *
     * @param accessToken 当前有效的 accessToken
     */
    suspend fun logout(accessToken: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$BASE_URL/api/auth/logout")
                    .post("".toRequestBody(JSON_MEDIA_TYPE))
                    .header("Authorization", "Bearer $accessToken")
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                val json = JSONObject(body)
                json.optInt("code", -1) == 200
            } catch (_: Exception) {
                false
            }
        }
    }

    /**
     * 解析通用 JSON 响应格式。
     *
     * ```json
     * { "code": 200, "message": "success", "data": { ... }, "timestamp": ... }
     * ```
     */
    private fun parseResponse(body: String): LoginResult {
        return try {
            val json = JSONObject(body)
            val code = json.optInt("code", -1)
            val message = json.optString("message", "Unknown error")

            if (code == 200) {
                val data = json.optJSONObject("data")
                if (data != null) {
                    LoginResult(
                        success = true,
                        code = code,
                        message = message,
                        data = LoginData(
                            accessToken = data.optString("accessToken", ""),
                            refreshToken = data.optString("refreshToken", ""),
                            tokenType = data.optString("tokenType", "Bearer"),
                            userId = data.optLong("userId", 0L),
                            username = data.optString("username", ""),
                            role = data.optString("role", "USER")
                        )
                    )
                } else {
                    LoginResult(success = true, code = code, message = message)
                }
            } else {
                LoginResult(success = false, code = code, message = message)
            }
        } catch (e: Exception) {
            LoginResult(
                success = false,
                code = -1,
                message = "Parse response failed: ${e.localizedMessage ?: "Unknown error"}"
            )
        }
    }
}