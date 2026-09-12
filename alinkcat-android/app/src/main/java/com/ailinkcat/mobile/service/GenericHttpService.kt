package com.ailinkcat.mobile.service

import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * 通用 HTTP 服务：GET/POST，Headers 与 Body 可自定义。
 * request() 返回 JSONObject；requestText() 返回原始响应文本（供 JSON 数据组件解析）。
 */
object GenericHttpService {
    private val client = OkHttpClient()

    private fun buildRequest(
        url: String,
        method: String = "GET",
        headers: Map<String, String> = emptyMap(),
        body: String? = null
    ): Request {
        val builder = Request.Builder().url(url)
        for ((k, v) in headers) {
            builder.addHeader(k, v)
        }
        when (method.uppercase()) {
            "GET" -> builder.get()
            "POST" -> {
                val media = body?.toRequestBody("application/json".toMediaType())
                    ?: ByteArray(0).toRequestBody()
                builder.post(media)
            }
            else -> throw IllegalArgumentException("Unsupported method $method")
        }
        return builder.build()
    }

    suspend fun request(
        url: String,
        method: String = "GET",
        headers: Map<String, String> = emptyMap(),
        body: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val respBody = requestText(url, method, headers, body)
        try {
            JSONObject(respBody)
        } catch (e: Exception) {
            Log.e("GenericHttpService", "Invalid JSON", e)
            throw IOException("Invalid JSON response")
        }
    }

    suspend fun requestText(
        url: String,
        method: String = "GET",
        headers: Map<String, String> = emptyMap(),
        body: String? = null,
        allowHttpError: Boolean = false
    ): String = withContext(Dispatchers.IO) {
        val call = client.newCall(buildRequest(url, method, headers, body))
        val response = call.execute()
        // 网关接口状态码不可靠（401/403 也可能是错误体）；allowHttpError=true 时非 2xx 也返回 body，由调用方解析
        if (!response.isSuccessful && !allowHttpError) {
            throw IOException("HTTP ${response.code}")
        }
        response.body?.string() ?: throw IOException("Empty response body")
    }
}
