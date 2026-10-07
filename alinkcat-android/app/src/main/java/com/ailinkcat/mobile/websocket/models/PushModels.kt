package com.ailinkcat.mobile.websocket.models

import org.json.JSONObject

/** message models for theme pack push (JSON-RPC notifications from the PC) */

data class ThemePushStart(
    val themeId: String,
    val name: String,
    val version: String,
    val size: Long,
    val totalChunks: Int,
    val hash: String
) {
    companion object {
        fun from(json: JSONObject): ThemePushStart? = try {
            ThemePushStart(
                themeId = json.getString("themeId"),
                name = json.getString("name"),
                version = json.getString("version"),
                size = json.optLong("size", 0L),
                totalChunks = json.optInt("totalChunks", 0),
                hash = json.getString("hash")
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ThemePushChunk(
    val themeId: String,
    val chunkIndex: Int,
    val data: String, // base64
    val isLast: Boolean
) {
    companion object {
        fun from(json: JSONObject): ThemePushChunk? = try {
            ThemePushChunk(
                themeId = json.getString("themeId"),
                chunkIndex = json.optInt("chunkIndex", 0),
                data = json.getString("data"),
                isLast = json.optBoolean("isLast", false)
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ThemePushComplete(
    val themeId: String,
    val status: String // 'success' | 'failed'
) {
    companion object {
        fun from(json: JSONObject): ThemePushComplete? = try {
            ThemePushComplete(
                themeId = json.getString("themeId"),
                status = json.optString("status", "failed")
            )
        } catch (_: Exception) {
            null
        }
    }
}

data class ThemePushCancel(
    val themeId: String
) {
    companion object {
        fun from(json: JSONObject): ThemePushCancel? = try {
            ThemePushCancel(themeId = json.getString("themeId"))
        } catch (_: Exception) {
            null
        }
    }
}

data class ThemePushError(
    val themeId: String,
    val code: Int,
    val message: String
) {
    companion object {
        fun from(json: JSONObject): ThemePushError? = try {
            ThemePushError(
                themeId = json.getString("themeId"),
                code = json.optInt("code", -1),
                message = json.optString("message", "Unknown error")
            )
        } catch (_: Exception) {
            null
        }
    }
}

// receive state

enum class ReceiveStatus {
    IDLE,
    PENDING_CONFIRM, // start received, waiting for user confirm
    RECEIVING,
    INTERRUPTED, // connection dropped, .part kept for resume
    COMPLETED,
    CANCELLED,
    FAILED
}

data class ReceiveState(
    val themeId: String = "",
    val themeName: String = "",
    val version: String = "",
    val totalSize: Long = 0L,
    val receivedSize: Long = 0L,
    val totalChunks: Int = 0,
    val receivedChunks: Int = 0,
    val status: ReceiveStatus = ReceiveStatus.IDLE,
    val progress: Float = 0f, // 0.0 - 1.0
    val speed: Float = 0f, // KB/s
    val errorMessage: String? = null,
    val isResume: Boolean = false // resuming from an interrupted transfer
)

// installed theme metadata

data class ThemeMeta(
    val themeId: String,
    val name: String,
    val version: String,
    val hash: String,
    val receivedAt: Long,
    val pageCount: Int = 1,
    val coverUrl: String? = null
)
