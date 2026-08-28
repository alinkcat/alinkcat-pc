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
 * 发起任意 HTTP 请求的通用服务。
 * 支持 GET 与 POST，Headers 与 Body 均可自定义。
 * request() 返回 JSONObject；requestText() 返回原始响应文本（供 JSON 数据组件解析对象/数组）。
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
        body: String? = null
    ): String = withContext(Dispatchers.IO) {
        val call = client.newCall(buildRequest(url, method, headers, body))
        val response = call.execute()
        if (!response.isSuccessful) {
            throw IOException("HTTP ${response.code}")
        }
        response.body?.string() ?: throw IOException("Empty response body")
    }
}
