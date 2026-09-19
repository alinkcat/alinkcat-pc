use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::server::ClientHandle;
use super::types::*;
use crate::monitor::scheduler::MonitorScheduler;
use crate::monitor::types::MonitorSubscribeParams;
use crate::services::launcher_service;
use crate::services::media_scheduler;
use crate::services::media_service;
use crate::services::snippet_service;

/// Handles messages after the handshake (completed during the connection phase in server.rs).
pub async fn dispatch(
    text: &str,
    client_id: &str,
    clients: &Arc<Mutex<HashMap<String, ClientHandle>>>,
    monitor: &Option<Arc<Mutex<MonitorScheduler>>>,
) -> String {
    let req: JsonRpcRequest = match serde_json::from_str(text) {
        Ok(r) => r,
        Err(_) => {
            return serde_json::to_string(&JsonRpcResponse::error(-32700, "Parse error", None))
                .unwrap();
        }
    };

    if req.jsonrpc != "2.0" {
        return serde_json::to_string(&JsonRpcResponse::error(
            -32600,
            "Invalid Request: missing jsonrpc 2.0",
            req.id,
        ))
        .unwrap();
    }

    println!("[WebSocket] dispatch: method='{}' from client={}", req.method, client_id);

    let resp = match req.method.as_str() {
        "action.execute" => handle_action_execute(&req, client_id, clients).await,
        "monitor.subscribe" => handle_monitor_subscribe(&req, client_id, monitor, true).await,
        "monitor.unsubscribe" => handle_monitor_subscribe(&req, client_id, monitor, false).await,
        "media.execute" => handle_media_execute(&req).await,
        "media.subscribe" => handle_media_subscribe(&req, client_id, true).await,
        "media.unsubscribe" => handle_media_subscribe(&req, client_id, false).await,
        "media.get_current" => handle_media_get_current(&req).await,
        "media.control" => handle_media_execute(&req).await,
        "theme.enter" => handle_theme_enter(&req, client_id, monitor, clients).await,
        "theme.leave" => handle_theme_leave(&req, client_id, monitor).await,
        "launcher.open" => handle_launcher_open(&req).await,
        "launcher.list" => handle_launcher_list(&req).await,
        "snippet.inject" => handle_snippet_inject(&req).await,
        "snippet.list" => handle_snippet_list(&req).await,
        _ => {
            println!("[WebSocket] ⚠ unknown method '{}' from {}", req.method, client_id);
            JsonRpcResponse::error(-32601, "Method not found", req.id)
        }
    };

    serde_json::to_string(&resp).unwrap()
}

async fn handle_action_execute(
    req: &JsonRpcRequest,
    _client_id: &str,
    _clients: &Arc<Mutex<HashMap<String, ClientHandle>>>,
) -> JsonRpcResponse {
    let params: ActionExecuteParams = match req
        .params
        .as_ref()
        .and_then(|p| serde_json::from_value(p.clone()).ok())
    {
        Some(p) => p,
        None => return JsonRpcResponse::error(-32602, "Invalid params", req.id.clone()),
    };

    let result = ActionExecuteResult {
        success: true,
        result: serde_json::json!({
            "widgetId": params.widget_id,
            "action": params.action,
            "status": "executed"
        }),
    };

    JsonRpcResponse::success(serde_json::to_value(result).unwrap(), req.id.clone())
}

async fn handle_monitor_subscribe(
    req: &JsonRpcRequest,
    client_id: &str,
    monitor: &Option<Arc<Mutex<MonitorScheduler>>>,
    subscribe: bool,
) -> JsonRpcResponse {
    let monitor = match monitor {
        Some(m) => m,
        None => return JsonRpcResponse::error(-32603, "Monitor not available", req.id.clone()),
    };

    let params: MonitorSubscribeParams = match req
        .params
        .as_ref()
        .and_then(|p| serde_json::from_value(p.clone()).ok())
    {
        Some(p) => p,
        None => return JsonRpcResponse::error(-32602, "Invalid params", req.id.clone()),
    };

    let mut mon = monitor.lock().await;
    if subscribe {
        mon.subscribe(client_id, params.sources.clone());
        // Ensure the scheduler is running before starting data pushes
        if !mon.is_running() {
            println!("[Monitor] Starting scheduler for client {}", client_id);
        }
        mon.start();
    } else {
        mon.unsubscribe(client_id, params.sources.clone());
        // Stop the scheduler when there are no subscribers
        if !mon.has_subscribers() {
            println!("[Monitor] No more subscribers, stopping scheduler");
            mon.stop();
        }
    }

    JsonRpcResponse::success(
        serde_json::json!({ "status": "ok", "sources": params.sources }),
        req.id.clone(),
    )
}

async fn handle_media_execute(req: &JsonRpcRequest) -> JsonRpcResponse {
    let action = req.params
        .as_ref()
        .and_then(|p| p.get("action"))
        .and_then(|a| a.as_str())
        .unwrap_or("");
    let volume_level = req.params.as_ref().and_then(|p| p.get("volume")).and_then(|v| v.as_f64());
    match media_service::execute_media_action(action, volume_level).await {
        Ok(()) => JsonRpcResponse::success(serde_json::json!({"status": "ok", "action": action}), req.id.clone()),
        Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
    }
}

async fn handle_media_get_current(req: &JsonRpcRequest) -> JsonRpcResponse {
    match media_service::get_media_info().await {
        Ok(info) => JsonRpcResponse::success(
            serde_json::json!({
                "title": info.title,
                "artist": info.artist,
                "album": info.album,
                "isPlaying": info.is_playing,
                "position": info.position,
                "duration": info.duration,
                "thumbnail": info.thumbnail,
                "displayMode": info.display_mode,
            }),
            req.id.clone(),
        ),
        Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
    }
}

async fn handle_media_subscribe(
    req: &JsonRpcRequest,
    client_id: &str,
    subscribe: bool,
) -> JsonRpcResponse {
    let sched = match media_scheduler::global_media_scheduler() {
        Some(s) => s,
        None => return JsonRpcResponse::error(-32603, "Media scheduler not available", req.id.clone()),
    };
    let mut s = sched.lock().await;
    if subscribe {
        s.subscribe(client_id, vec!["media".into()]);
    } else {
        s.unsubscribe(client_id, vec!["media".into()]);
    }
    JsonRpcResponse::success(serde_json::json!({"status": "ok"}), req.id.clone())
}

const ALL_MONITOR_SOURCES: &[&str] = &["cpu", "memory", "network", "disk", "uptime", "battery"];

/// Client enters a theme page: activate hardware monitoring and media-state push loops as needed.
/// Start only while the connection is online to avoid pushing to a disconnected node.
async fn handle_theme_enter(
    req: &JsonRpcRequest,
    client_id: &str,
    monitor: &Option<Arc<Mutex<MonitorScheduler>>>,
    clients: &Arc<Mutex<HashMap<String, ClientHandle>>>,
) -> JsonRpcResponse {
    let theme_id = req.params
        .as_ref()
        .and_then(|p| p.get("themeId"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Verify that the WebSocket connection is still active
    let online = { clients.lock().await.contains_key(client_id) };
    if !online {
        return JsonRpcResponse::error(-32603, "connection closed, cannot activate push", req.id.clone());
    }

    if let Some(mon) = monitor {
        let mut m = mon.lock().await;
        m.subscribe(client_id, ALL_MONITOR_SOURCES.iter().map(|s| s.to_string()).collect());
    }
    if let Some(sched) = media_scheduler::global_media_scheduler() {
        let mut s = sched.lock().await;
        s.subscribe(client_id, vec!["media".into()]);
    }
    println!(
        "[Monitor] client {} entered theme({})，started pushing data",
        client_id,
        if theme_id.is_empty() { "unknown theme".to_string() } else { theme_id }
    );
    JsonRpcResponse::success(serde_json::json!({"status": "ok", "active": true}), req.id.clone())
}

/// Client leaves a theme page: immediately end its monitoring and media push subscriptions.
/// If no other subscribers remain, automatically stop the corresponding scheduler (cancel/abort polling tasks).
async fn handle_theme_leave(
    req: &JsonRpcRequest,
    client_id: &str,
    monitor: &Option<Arc<Mutex<MonitorScheduler>>>,
) -> JsonRpcResponse {
    if let Some(mon) = monitor {
        let mut m = mon.lock().await;
        m.unsubscribe(client_id, ALL_MONITOR_SOURCES.iter().map(|s| s.to_string()).collect());
    }
    if let Some(sched) = media_scheduler::global_media_scheduler() {
        let mut s = sched.lock().await;
        s.unsubscribe(client_id, vec!["media".into()]);
    }
    println!("[Monitor] clientleft theme, stopped pushing data to this node。 (client: {})", client_id);
    JsonRpcResponse::success(serde_json::json!({"status": "ok", "active": false}), req.id.clone())
}

async fn handle_launcher_open(req: &JsonRpcRequest) -> JsonRpcResponse {
    // Supports two modes: launch directly by path or look up a registered item by ID
    let path = req.params.as_ref().and_then(|p| p.get("path")).and_then(|v| v.as_str()).filter(|s| !s.is_empty());
    let id = req.params.as_ref().and_then(|p| p.get("id")).and_then(|v| v.as_str()).filter(|s| !s.is_empty());

    if let Some(p) = path {
        match launcher_service::launch_path(p) {
            Ok(()) => JsonRpcResponse::success(serde_json::json!({"status": "ok"}), req.id.clone()),
            Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
        }
    } else if let Some(id_val) = id {
        match launcher_service::open(id_val) {
            Ok(()) => JsonRpcResponse::success(serde_json::json!({"status": "ok"}), req.id.clone()),
            Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
        }
    } else {
        JsonRpcResponse::error(-32602, "Missing path or id", req.id.clone())
    }
}

async fn handle_snippet_inject(req: &JsonRpcRequest) -> JsonRpcResponse {
    let text = req.params.as_ref().and_then(|p| p.get("text")).and_then(|v| v.as_str()).unwrap_or("");
    if text.is_empty() {
        return JsonRpcResponse::error(-32602, "Missing text", req.id.clone());
    }
    match snippet_service::inject_snippet(text) {
        Ok(()) => JsonRpcResponse::success(serde_json::json!({"status": "ok", "length": text.len()}), req.id.clone()),
        Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
    }
}

/// Return the list of registered launchers so the Android client can display them.
async fn handle_launcher_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let items = launcher_service::list();
    let list = items
        .iter()
        .map(|i| serde_json::json!({ "id": &i.id, "name": &i.name, "path": &i.path }))
        .collect::<Vec<_>>();
    JsonRpcResponse::success(serde_json::json!({ "items": list }), req.id.clone())
}

/// Return the list of saved snippets. Currently reads from ~/.ilinkcat/snippets.json.
async fn handle_snippet_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let path = dirs::home_dir()
        .map(|h| h.join(".ilinkcat").join("snippets.json"))
        .unwrap_or_default();
    let items: Vec<serde_json::Value> = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(&s).ok())
            .unwrap_or_default()
    } else {
        vec![]
    };
    JsonRpcResponse::success(serde_json::json!({ "items": items }), req.id.clone())
}
