use std::path::PathBuf;
use std::path::Path;
use std::sync::Arc;

use tauri::State;
use tokio::sync::Mutex;

pub mod launcher_commands;
pub mod media_commands;
pub mod calendar_commands;
pub mod snippet_commands;
pub mod theme_push_commands;
pub mod upload_commands;
pub mod webview_commands;
pub mod generic_http;
pub mod ai_chat_stream;

use crate::action::executor;
use crate::action::types::*;
use crate::monitor::scheduler::MonitorScheduler;
use crate::monitor::types::PerfSnapshot;
use crate::theme::manager;
use crate::theme::config;
use crate::theme::types::*;
use crate::websocket::server::WebSocketServer;
use crate::websocket::types::{ClientInfo, ConnectionLog, ServerStatus};

// ─── WebSocket State ────────────────────────────────────────

pub struct WsServerState {
    pub server: Arc<Mutex<WebSocketServer>>,
}

#[tauri::command]
pub async fn start_server(state: State<'_, WsServerState>) -> Result<String, String> {
    let mut server = state.server.lock().await;
    server.start().await
}

#[tauri::command]
pub async fn stop_server(state: State<'_, WsServerState>) -> Result<(), String> {
    let mut server = state.server.lock().await;
    server.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn get_connections(state: State<'_, WsServerState>) -> Result<Vec<ClientInfo>, String> {
    let server = state.server.lock().await;
    Ok(server.get_connections().await)
}

#[tauri::command]
pub async fn broadcast(state: State<'_, WsServerState>, message: String) -> Result<(), String> {
    let server = state.server.lock().await;
    server.broadcast(&message).await;
    Ok(())
}

#[tauri::command]
pub async fn send_ws_message(
    state: State<'_, WsServerState>,
    client_id: String,
    message: String,
) -> Result<(), String> {
    let server = state.server.lock().await;
    server.send_to_client(&client_id, &message).await
}

// ─── 诊断命令 ───────────────────────────────────────────────

#[tauri::command]
pub async fn get_server_status(state: State<'_, WsServerState>) -> Result<ServerStatus, String> {
    let server = state.server.lock().await;
    Ok(ServerStatus {
        running: server.is_running().await,
        port: server.get_port(),
        connections: server.get_connections().await.len(),
    })
}

#[tauri::command]
pub async fn get_connection_logs(state: State<'_, WsServerState>) -> Result<Vec<ConnectionLog>, String> {
    let server = state.server.lock().await;
    Ok(server.get_logs())
}

#[tauri::command]
pub async fn get_pairing_code(state: State<'_, WsServerState>) -> Result<String, String> {
    let server = state.server.lock().await;
    Ok(server.get_pairing_code().await)
}

#[tauri::command]
pub async fn regenerate_pairing_code(state: State<'_, WsServerState>) -> Result<String, String> {
    let server = state.server.lock().await;
    Ok(server.regenerate_pairing_code().await)
}

/// 获取本机所有非回环的 IPv4 局域网地址（用于手机端连接二维码）。
#[tauri::command]
pub fn get_local_ip() -> Vec<String> {    let mut ips = Vec::new();
    if let Ok(list) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in list {
            if ip.is_loopback() {
                continue;
            }
            if let std::net::IpAddr::V4(v4) = ip {
                if name.to_lowercase().contains("lo") {
                    continue;
                }
                ips.push(v4.to_string());
            }
        }
    }
    // 枚举失败时回退到 UDP socket 探测
    if ips.is_empty() {
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    if let std::net::IpAddr::V4(v4) = addr.ip() {
                        ips.push(v4.to_string());
                    }
                }
            }
        }
    }
    ips
}

// ─── Theme Commands ─────────────────────────────────────────

#[tauri::command]
pub fn scan_themes() -> Result<Vec<ThemeSummary>, String> {
    // Retrieve all themes then filter out any built‑in themes that have been marked as deleted.
    let mut themes = manager::scan_themes()?;
    let cfg = config::load_config();
    if !cfg.deleted_builtin_themes.is_empty() {
        themes.retain(|t| !cfg.deleted_builtin_themes.contains(&t.id));
    }
    Ok(themes)
}

#[tauri::command]
pub fn load_theme(id: String) -> Result<ThemeMeta, String> {
    manager::load_theme(&id)
}

#[tauri::command]
pub fn activate_theme(id: String) -> Result<(), String> {
    manager::activate_theme(&id)
}

#[tauri::command]
pub fn get_active_theme() -> Option<String> {
    manager::get_active_theme()
}

#[tauri::command]
pub fn import_theme(path: String) -> Result<ThemeMeta, String> {
    manager::import_theme(&PathBuf::from(path))
}

#[tauri::command]
pub fn delete_theme(id: String) -> Result<(), String> {
    manager::delete_theme(&id)
}

#[tauri::command]
pub fn list_theme_files(id: String) -> Result<Vec<serde_json::Value>, String> {
    let dir = manager::get_theme_dir(&id)?;
    let mut files = Vec::new();
    list_files_recursive(&dir, &dir, &mut files)?;
    Ok(files)
}

fn list_files_recursive(base: &Path, dir: &Path, files: &mut Vec<serde_json::Value>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read dir: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let relative = path.strip_prefix(base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let metadata = std::fs::metadata(&path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;
        if path.is_dir() {
            files.push(serde_json::json!({
                "name": relative,
                "isDir": true,
                "size": 0,
            }));
            list_files_recursive(base, &path, files)?;
        } else {
            files.push(serde_json::json!({
                "name": relative,
                "isDir": false,
                "size": metadata.len(),
            }));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn save_theme(
    mut theme: ThemeMeta,
    cover_path: Option<String>,
    cover_data: Option<String>,
) -> Result<(), String> {
    manager::save_theme(
        &mut theme,
        cover_path.as_deref().map(Path::new),
        cover_data.as_deref(),
    )
}

#[tauri::command]
pub fn get_theme_path(id: String) -> Result<String, String> {
    manager::get_theme_dir(&id).map(|p| p.to_string_lossy().to_string())
}

// ─── Image Commands ─────────────────────────────────────────

#[tauri::command]
pub fn save_image(image_data: String, theme_id: String, widget_id: String) -> Result<String, String> {
    crate::services::image_service::save_image_data(&image_data, &theme_id, &widget_id)
}

#[tauri::command]
pub fn save_icon(image_data: String, theme_id: String, widget_id: String) -> Result<String, String> {
    crate::services::image_service::save_icon_data(&image_data, &theme_id, &widget_id)
}

#[tauri::command]
pub fn get_image(theme_id: String, image_path: String) -> Result<String, String> {
    crate::services::image_service::get_image_data(&theme_id, &image_path)
}

#[tauri::command]
pub fn delete_image(theme_id: String, image_path: String) -> Result<(), String> {
    crate::services::image_service::delete_image(&theme_id, &image_path)
}

#[tauri::command]
pub fn export_theme(id: String, output_path: String) -> Result<(), String> {
    manager::export_theme(&id, &PathBuf::from(output_path))
}

// ─── Action Commands ────────────────────────────────────────

#[tauri::command]
pub fn execute_action(action: ActionDefinition) -> Result<ActionResult, String> {
    executor::execute(&action)
}

// ─── Monitor Commands ───────────────────────────────────────

pub struct MonitorState {
    pub scheduler: Mutex<MonitorScheduler>,
}

#[tauri::command]
pub async fn start_monitor(state: State<'_, MonitorState>) -> Result<(), String> {
    let mut sched = state.scheduler.lock().await;
    sched.start();
    Ok(())
}

#[tauri::command]
pub async fn stop_monitor(state: State<'_, MonitorState>) -> Result<(), String> {
    let mut sched = state.scheduler.lock().await;
    sched.stop();
    Ok(())
}

#[tauri::command]
pub async fn get_current_snapshot(state: State<'_, MonitorState>) -> Result<PerfSnapshot, String> {
    let mut sched = state.scheduler.lock().await;
    if sched.is_running() {
        Ok(sched.get_snapshot())
    } else {
        Ok(sched.take_snapshot_now())
    }
}

#[tauri::command]
pub async fn download_theme_file(url: String, filename: String) -> Result<String, String> {
    let download_dir = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".ilinkcat")
        .join("downloads");
    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Failed to create downloads dir: {}", e))?;

    let file_path = download_dir.join(&filename);
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read response failed: {}", e))?;
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

/// 保存文本内容到指定路径（用于日志导出等）。
#[tauri::command]
pub fn save_text_file(path: String, content: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    std::fs::write(&p, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn import_theme_from_file(path: String) -> Result<ThemeMeta, String> {
    let result = manager::import_theme(&PathBuf::from(&path));
    if result.is_ok() {
        let _ = std::fs::remove_file(&path);
    }
    result
}

#[tauri::command]
pub fn oauth_reset() -> Result<(), String> {
    crate::services::oauth_callback_server::reset_token();
    Ok(())
}

#[tauri::command]
pub fn oauth_wait_token(timeout_secs: u64) -> Result<serde_json::Value, String> {
    let oauth = crate::services::oauth_callback_server::wait_for_token(timeout_secs)?;
    Ok(serde_json::json!({
        "token": oauth.token,
        "refreshToken": oauth.refresh_token,
        "username": oauth.username,
    }))
}

#[tauri::command]
pub fn oauth_poll() -> Result<serde_json::Value, String> {
    crate::services::oauth_callback_server::poll_token()
}

/// 获取设备唯一标识码（持久化到 ~/.ilinkcat/device_code，不随浏览器缓存清除）
#[tauri::command]
pub fn get_device_code() -> Result<String, String> {
    use std::io::{Read, Write};
    let dir = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".ilinkcat");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create dir: {}", e))?;
    let path = dir.join("device_code");
    if path.exists() {
        let mut buf = String::new();
        std::fs::File::open(&path)
            .and_then(|mut f| f.read_to_string(&mut buf))
            .map_err(|e| format!("Failed to read device code: {}", e))?;
        let code = buf.trim().to_string();
        if !code.is_empty() { return Ok(code); }
    }
    // 生成新 UUID v4
    let code = uuid::Uuid::new_v4().to_string();
    let mut f = std::fs::File::create(&path)
        .map_err(|e| format!("Failed to write device code: {}", e))?;
    f.write_all(code.as_bytes())
        .map_err(|e| format!("Failed to write device code: {}", e))?;
    Ok(code)
}

/// 通用 API 请求（通过 Rust 后端发起，绕过 CORS）。
/// 支持 GET/POST/PUT/DELETE，JSON body，自定义 headers。
#[tauri::command]
pub async fn api_request(
    url: String,
    method: Option<String>,
    body: Option<serde_json::Value>,
    headers: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let method = method.unwrap_or_else(|| "GET".to_string()).to_uppercase();
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")
        .cookie_store(true)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut req = match method.as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        _ => client.get(&url),
    };

    // 默认浏览器标识头
    req = req.header("Accept", "application/json, text/plain, */*");
    req = req.header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");

    // 附加自定义 headers
    if let Some(h) = headers {
        if let Some(map) = h.as_object() {
            for (k, v) in map {
                if let Some(val) = v.as_str() {
                    req = req.header(k.as_str(), val);
                }
            }
        }
    }

    // JSON body
    if let Some(b) = body {
        req = req.json(&b);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status().as_u16();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    // 尝试解析 JSON，失败则返回原文
    match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(json) if text.trim_start().starts_with('{') || text.trim_start().starts_with('[') => {
            Ok(serde_json::json!({
                "status": status,
                "body": json,
            }))
        }
        _ => Ok(serde_json::json!({
            "status": status,
            "body": text,
        })),
    }
}
