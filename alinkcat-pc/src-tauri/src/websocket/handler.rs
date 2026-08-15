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

/// 处理握手之后的消息（握手在 server.rs 的连接阶段完成）。
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
        "snippet.inject" => handle_snippet_inject(&req).await,
        _ => JsonRpcResponse::error(-32601, "Method not found", req.id),
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
        // 确保调度器正在运行，开始推送数据
        if !mon.is_running() {
            println!("[Monitor] Starting scheduler for client {}", client_id);
        }
        mon.start();
    } else {
        mon.unsubscribe(client_id, params.sources.clone());
        // 无订阅者时停止调度器
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

const ALL_MONITOR_SOURCES: &[&str] = &["cpu", "memory", "network", "disk", "uptime"];

/// 客户端进入主题页面：按需激活该客户端的硬件监控与媒体状态推送循环。
/// 仅当连接仍在线时才允许启动，避免向已断开节点推送。
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

    // 校验 WebSocket 连接仍处于正常连接状态
    let online = { clients.lock().await.contains_key(client_id) };
    if !online {
        return JsonRpcResponse::error(-32603, "连接已断开，无法激活推送", req.id.clone());
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
        "[Monitor] 客户端 {} 进入主题({})，开始推送数据",
        client_id,
        if theme_id.is_empty() { "未知主题".to_string() } else { theme_id }
    );
    JsonRpcResponse::success(serde_json::json!({"status": "ok", "active": true}), req.id.clone())
}

/// 客户端离开主题页面：立即终止该客户端的监控与媒体推送订阅，
/// 若无其他订阅者则自动停止对应调度器（Cancel/Abort 轮询任务）。
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
    println!("[Monitor] 客户端已离开主题，停止向该节点推送数据。 (client: {})", client_id);
    JsonRpcResponse::success(serde_json::json!({"status": "ok", "active": false}), req.id.clone())
}

async fn handle_launcher_open(req: &JsonRpcRequest) -> JsonRpcResponse {
    let id = req.params.as_ref().and_then(|p| p.get("id")).and_then(|v| v.as_str()).unwrap_or("");
    if id.is_empty() {
        return JsonRpcResponse::error(-32602, "Missing id", req.id.clone());
    }
    match launcher_service::open(id) {
        Ok(()) => JsonRpcResponse::success(serde_json::json!({"status": "ok"}), req.id.clone()),
        Err(e) => JsonRpcResponse::error(-32000, &e, req.id.clone()),
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
