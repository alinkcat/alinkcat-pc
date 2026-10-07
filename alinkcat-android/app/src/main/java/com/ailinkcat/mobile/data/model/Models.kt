package com.ailinkcat.mobile.data.model

/** launchable app on the PC (program/shortcut) */
data class LauncherApp(
    val id: String,
    val name: String,
    val iconUrl: String? = null,
    val position: Int = 0
)

/** text snippet */
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

/** connection failure categories, for friendlier error messages */
enum class ConnectionErrorType {
    NETWORK_UNREACHABLE,
    PORT_CLOSED,
    CONNECTION_TIMEOUT,
    HANDSHAKE_TIMEOUT,
    PAIRING_CODE_ERROR,
    DUPLICATE_CONNECTION,
    DEVICE_LIMIT,
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
    val deviceName: String = "My Android",
    val lastConnectedIp: String = "",
    val lastConnectedPort: String = "",
    /** weather refresh interval in seconds, >0 overrides theme refreshInterval, 0 = theme default */
    val weatherRefreshSeconds: Int = 0,
    /** fallback city when location fails, empty = theme default */
    val fallbackCity: String = ""
)
