package com.ailinkcat.mobile.websocket.models

import org.json.JSONObject

/**
 * PC 端推送主题包的消息模型（JSON-RPC 通知）。
 */

// 推送开始
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

// 数据块
data class ThemePushChunk(
    val themeId: String,
    val chunkIndex: Int,
    val data: String, // Base64 编码
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

// 完成通知
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

// 取消通知
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

// 错误通知
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
                message = json.optString("message", "未知错误")
            )
        } catch (_: Exception) {
            null
        }
    }
}

// ─── 接收状态 ───────────────────────────────────────────────

enum class ReceiveStatus {
    IDLE,
    PENDING_CONFIRM, // 已收到 start，等待用户确认
    RECEIVING,
    INTERRUPTED, // 连接中断，保留 .part 等待恢复
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
    val isResume: Boolean = false // 是否为断点续传
)

// ─── 已安装主题元数据 ───────────────────────────────────────

data class ThemeMeta(
    val themeId: String,
    val name: String,
    val version: String,
    val hash: String,
    val receivedAt: Long
)
