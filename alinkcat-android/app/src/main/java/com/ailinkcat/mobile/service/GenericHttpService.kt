package com.ailinkcat.mobile.service

import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** generic GET/POST with custom headers/body; request() parses JSON, requestText() returns raw text */
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
        // gateway status codes aren't reliable (401/403 can carry an error body);
        // with allowHttpError the caller gets the body even on non-2xx
        if (!response.isSuccessful && !allowHttpError) {
            throw IOException("HTTP ${response.code}")
        }
        response.body?.string() ?: throw IOException("Empty response body")
    }
}
