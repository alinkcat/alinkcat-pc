package com.ailinkcat.mobile.data

import org.json.JSONArray
import org.json.JSONObject

/** JSON-RPC 2.0 helpers. the client initiates the handshake request (with pairing code),
 *  the server replies with result or error */
object JsonRpc {

    /** e.g. {"jsonrpc":"2.0","id":1,"method":"handshake","params":{"deviceName":...,"pairingCode":...}} */
    fun buildHandshakeRequest(
        deviceName: String,
        appVersion: String,
        pairingCode: String,
        requestId: Int = 1
    ): String {
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", requestId)
            .put("method", "handshake")
            .put(
                "params",
                JSONObject()
                    .put("deviceName", deviceName)
                    .put("appVersion", appVersion)
                    .put("pairingCode", pairingCode)
            )
            .toString()
    }

    /** returns null for non-JSON-RPC messages */
    fun parseMessage(json: String): RpcMessage? {
        return try {
            val root = JSONObject(json)
            if (!root.has("jsonrpc")) return null
            RpcMessage(
                id = root.optInt("id", -1),
                method = root.optString("method").ifBlank { null },
                params = root.optJSONObject("params"),
                result = root.optJSONObject("result"),
                error = root.optJSONObject("error")
            )
        } catch (_: Exception) {
            null
        }
    }

    fun parseHandshakeResponse(json: String): HandshakeResult {
        return try {
            val root = JSONObject(json)
            val result = root.optJSONObject("result")
            if (result != null) {
                HandshakeResult(
                    status = result.optString("status").ifBlank { null },
                    deviceId = result.optString("deviceId").ifBlank { null },
                    serverVersion = result.optString("serverVersion").ifBlank { null },
                    serverName = result.optString("serverName").ifBlank { null },
                    themeList = parseStringArray(result.optJSONArray("themeList"))
                )
            } else {
                val error = root.optJSONObject("error")
                HandshakeResult(
                    errorCode = error?.optInt("code", -1),
                    errorMessage = error?.optString("message")?.ifBlank { null }
                        ?: "Unknown error"
                )
            }
        } catch (_: Exception) {
            HandshakeResult(errorMessage = "Cannot parse server response")
        }
    }

    private fun parseStringArray(array: JSONArray?): List<String> {
        if (array == null) return emptyList()
        return buildList {
            for (i in 0 until array.length()) {
                array.optString(i).takeIf { it.isNotBlank() }?.let(::add)
            }
        }
    }

    fun buildRequest(method: String, params: JSONObject, id: Int): String {
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("method", method)
            .put("params", params)
            .toString()
    }

    fun buildResponse(id: Int, result: JSONObject): String {
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("result", result)
            .toString()
    }

    fun buildErrorResponse(id: Int, code: Int, message: String): String {
        return JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put(
                "error",
                JSONObject()
                    .put("code", code)
                    .put("message", message)
            )
            .toString()
    }

    data class RpcMessage(
        val id: Int = -1,
        val method: String? = null,
        val params: JSONObject? = null,
        val result: JSONObject? = null,
        val error: JSONObject? = null
    )

    data class HandshakeResult(
        val status: String? = null,
        val deviceId: String? = null,
        val serverVersion: String? = null,
        val serverName: String? = null,
        val themeList: List<String> = emptyList(),
        val errorCode: Int? = null,
        val errorMessage: String? = null
    )
}
