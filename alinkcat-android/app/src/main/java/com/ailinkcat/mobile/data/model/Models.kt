package com.ailinkcat.mobile.data.model

/**
 * 快捷启动应用（PC 端程序/快捷方式）。
 */
data class LauncherApp(
    val id: String,
    val name: String,
    val iconUrl: String? = null,
    val position: Int = 0
)

/**
 * 文本片段。
 */
data class SnippetItem(
    val id: String,
    val label: String,
    val content: String,
    val category: String? = null
)

data class ConnectionState(
    val status: ConnectionStatus = ConnectionStatus.Idle,
    val errorMessage: String? = null,
    val errorType: ConnectionErrorType? = null,
    val deviceName: String? = null,
    val serverVersion: String? = null
)

enum class ConnectionStatus {
    Idle, Connecting, Connected, Disconnected, Error
}

/**
 * 连接失败原因分类，用于向用户展示友好的错误提示。
 */
enum class ConnectionErrorType {
    NETWORK_UNREACHABLE,
    PORT_CLOSED,
    CONNECTION_TIMEOUT,
    HANDSHAKE_TIMEOUT,
    PAIRING_CODE_ERROR,
    DUPLICATE_CONNECTION,
    UNKNOWN
}

data class ThemePackage(
    val themeId: String? = null,
    val name: String,
    val version: String,
    val author: String,
    val pageCount: Int,
    val isActive: Boolean,
    val coverEmoji: String = "🎨",
    val coverColor: Long = 0xFF4F6EF7
)

data class StoredConfig(
    val ip: String = "192.168.1.100",
    val port: String = "9527",
    val pairCode: String = "",
    val deviceName: String = "我的 Android",
    val lastConnectedIp: String = "",
    val lastConnectedPort: String = ""
)
