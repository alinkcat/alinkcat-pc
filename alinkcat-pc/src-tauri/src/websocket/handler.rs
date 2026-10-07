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

/// handle messages after the handshake (handshake happens in server.rs)
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
        "launcher.list" => handle_launcher_list(&req).await,
        "snippet.inject" => handle_snippet_inject(&req).await,
        "snippet.list" => handle_snippet_list(&req).await,
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
        if !mon.is_running() {
            println!("[Monitor] Starting scheduler for client {}", client_id);
        }
        mon.start();
    } else {
        mon.unsubscribe(client_id, params.sources.clone());
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

/// client entered a theme page: start monitor + media push loops for that client on demand
/// only allowed while the connection is still online, no pushing to dead nodes
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

/// client left the theme page: drop its monitor and media subscriptions right away,
/// the schedulers stop themselves if no other subscribers remain
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
    // two ways in: launch by path directly, or look up a registered entry by id
    let path = req.params.as_ref().and_then(|p| p.get("path")).and_then(|v| v.as_str()).filter(|s| !s.is_empty());
    let id = req.params.as_ref().and_then(|p| p.get("id")).and_then(|v| v.as_str()).filter(|s| !s.is_empty());

    if let Some(p) = path {
        // remote launches must leave a log trail
        println!("[WebSocket] launcher.open path={} (remote device request)", p);
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

/// launcher list for the phone's macro panel. icon is a PC-local path, useless to the phone, so it's not sent
async fn handle_launcher_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let apps: Vec<serde_json::Value> = launcher_service::list()
        .iter()
        .enumerate()
        .map(|(i, item)| {
            serde_json::json!({
                "id": item.id,
                "name": item.name,
                "position": i
            })
        })
        .collect();
    JsonRpcResponse::success(serde_json::json!({ "apps": apps }), req.id.clone())
}

/// snippet list, data comes from the frontend's sync_snippets
async fn handle_snippet_list(req: &JsonRpcRequest) -> JsonRpcResponse {
    let snippets: Vec<serde_json::Value> = crate::services::snippet_store::list()
        .iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "label": s.label,
                "content": s.content
            })
        })
        .collect();
    JsonRpcResponse::success(serde_json::json!({ "snippets": snippets }), req.id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::Mutex as AsyncMutex;

    fn empty_clients() -> Arc<AsyncMutex<HashMap<String, ClientHandle>>> {
        Arc::new(AsyncMutex::new(HashMap::new()))
    }

    async fn dispatch_method(method: &str, params: serde_json::Value) -> serde_json::Value {
        let text = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 7,
            "method": method,
            "params": params
        })
        .to_string();
        let resp = dispatch(&text, "test-client", &empty_clients(), &None).await;
        serde_json::from_str(&resp).expect("response should be valid json")
    }

    #[tokio::test]
    async fn launcher_list_returns_apps_array() {
        let resp = dispatch_method("launcher.list", serde_json::json!({})).await;
        let result = resp.get("result").expect("success response");
        assert!(result.get("apps").and_then(|a| a.as_array()).is_some());
    }

    #[tokio::test]
    async fn snippet_list_returns_synced_snippets() {
        crate::services::snippet_store::set_all(vec![crate::services::snippet_store::SnippetEntry {
            id: "s1".into(),
            label: "hello".into(),
            content: "world".into(),
        }]);
        let resp = dispatch_method("snippet.list", serde_json::json!({})).await;
        let result = resp.get("result").expect("success response");
        let items = result
            .get("snippets")
            .and_then(|a| a.as_array())
            .expect("snippets array");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].get("label").and_then(|v| v.as_str()), Some("hello"));
        assert_eq!(items[0].get("content").and_then(|v| v.as_str()), Some("world"));
    }

    #[tokio::test]
    async fn unknown_method_returns_32601() {
        let resp = dispatch_method("nope.list", serde_json::json!({})).await;
        assert_eq!(resp.get("error").and_then(|e| e.get("code")).and_then(|c| c.as_i64()), Some(-32601));
    }
}
