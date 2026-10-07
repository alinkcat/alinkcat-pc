use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ─── Handshake error codes ──────────────────────────────────
pub const ERR_INVALID_PAIRING_CODE: i32 = -32001;
pub const ERR_HANDSHAKE_TIMEOUT: i32 = -32002;
pub const ERR_DUPLICATE_CONNECTION: i32 = -32003;

// ─── Client Info ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub client_id: String,
    pub device_name: String,
    pub ip_address: String,
    pub app_version: String,
    pub connected_at: DateTime<Utc>,
}

// ─── Server status / connection logs ────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub connections: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionLog {
    pub time: DateTime<Utc>,
    pub message: String,
}

// ─── JSON-RPC 2.0 Protocol ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    #[serde(default)]
    pub params: Option<serde_json::Value>,
    #[serde(default)]
    pub id: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
    pub id: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

// ─── Handshake ──────────────────────────────────────────────
// Phone -> PC: method = "handshake", with the pairing code in params
// PC -> phone: result { status, serverVersion, serverName, deviceId, themeList }
//              or error { code: -32001/-32002/-32003, message }

#[derive(Debug, Deserialize)]
pub struct HandshakeParams {
    #[serde(rename = "deviceName")]
    pub device_name: String,
    #[serde(rename = "appVersion")]
    pub app_version: String,
    #[serde(rename = "pairingCode")]
    pub pairing_code: String,
}

#[derive(Debug, Serialize)]
pub struct HandshakeResult {
    pub status: &'static str,
    #[serde(rename = "serverVersion")]
    pub server_version: String,
    #[serde(rename = "serverName")]
    pub server_name: String,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "themeList")]
    pub theme_list: Vec<String>,
}

// ─── Action.Execute ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ActionExecuteParams {
    #[serde(rename = "widgetId")]
    pub widget_id: String,
    pub action: String,
}

#[derive(Debug, Serialize)]
pub struct ActionExecuteResult {
    pub success: bool,
    pub result: serde_json::Value,
}

// ─── Helpers ────────────────────────────────────────────────

impl JsonRpcResponse {
    pub fn success(result: serde_json::Value, id: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            result: Some(result),
            error: None,
            id,
        }
    }

    pub fn error(code: i32, message: &str, id: Option<serde_json::Value>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
                data: None,
            }),
            id,
        }
    }
}
