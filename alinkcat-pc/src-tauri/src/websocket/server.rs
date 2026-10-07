use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use tauri::Emitter;
use rand::Rng;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

use super::ack_bus::AckBus;
use super::handler;
use super::types::*;
use crate::monitor::scheduler::MonitorScheduler;

pub type ClientSender = mpsc::UnboundedSender<String>;

pub struct ClientHandle {
    pub info: ClientInfo,
    pub sender: ClientSender,
}

const DEFAULT_PORT: u16 = 9527;
const MAX_PORT_ATTEMPTS: u16 = 5;
const HANDSHAKE_TIMEOUT_SECS: u64 = 10;
const MAX_LOGS: usize = 50;

/// max concurrent devices: free plan is single-device, raise this (or read it
/// from the membership config) once paid multi-device ships
const MAX_DEVICES: usize = 1;

pub struct WebSocketServer {
    pub clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
    pub pairing_code: Arc<Mutex<String>>,
    pub is_running: Arc<Mutex<bool>>,
    pub port: Arc<std::sync::Mutex<u16>>,
    pub logs: Arc<std::sync::Mutex<VecDeque<ConnectionLog>>>,
    pub monitor: Option<Arc<Mutex<MonitorScheduler>>>,
    pub ack_bus: AckBus,
    /// frontend listens for "ws-clients-changed" to keep the device counter live
    app_handle: Option<tauri::AppHandle>,
    task_handle: Option<tokio::task::JoinHandle<()>>,
}

/// the phone keeps one main connection plus a "(Display)" render connection —
/// both belong to the same physical device
fn base_device_name(name: &str) -> &str {
    name.strip_suffix(" (Display)").unwrap_or(name)
}

impl WebSocketServer {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            pairing_code: Arc::new(Mutex::new(String::new())),
            is_running: Arc::new(Mutex::new(false)),
            port: Arc::new(std::sync::Mutex::new(DEFAULT_PORT)),
            logs: Arc::new(std::sync::Mutex::new(VecDeque::new())),
            monitor: None,
            ack_bus: AckBus::new(),
            app_handle: None,
            task_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: tauri::AppHandle) {
        self.app_handle = Some(handle);
    }

    /// count distinct physical devices (main + "(Display)" connections collapse to one)
    pub async fn device_count(&self) -> usize {
        let map = self.clients.lock().await;
        let mut names: HashSet<&str> = HashSet::new();
        for c in map.values() {
            names.insert(base_device_name(&c.info.device_name));
        }
        names.len()
    }

    /// notify the frontend so the footer counter updates the moment a device
    /// connects or drops, instead of waiting for the next poll
    fn emit_clients_changed(&self) {
        if let Some(app) = &self.app_handle {
            let _ = app.emit("ws-clients-changed", ());
        }
    }

    pub fn set_monitor(&mut self, monitor: Arc<Mutex<MonitorScheduler>>) {
        self.monitor = Some(monitor);
    }

    pub fn set_clients(&mut self, clients: Arc<Mutex<HashMap<String, ClientHandle>>>) {
        self.clients = clients;
    }

    pub fn set_ack_bus(&mut self, ack_bus: AckBus) {
        self.ack_bus = ack_bus;
    }

    fn gen_pairing_code() -> String {
        let mut rng = rand::rng();
        format!("{:04}", rng.random_range(0u32..10000))
    }

    fn pairing_code_path() -> PathBuf {
        dirs::home_dir()
            .expect("Cannot determine home directory")
            .join(".ilinkcat")
            .join("pairing_code.txt")
    }

    fn load_saved_pairing_code() -> Option<String> {
        let path = Self::pairing_code_path();
        fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
    }

    fn save_pairing_code(code: &str) {
        let path = Self::pairing_code_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(&path, code);
    }

    pub fn generate_and_save_pairing_code() -> String {
        let code = Self::gen_pairing_code();
        Self::save_pairing_code(&code);
        code
    }

    pub fn push_log(logs: &Arc<std::sync::Mutex<VecDeque<ConnectionLog>>>, message: impl Into<String>) {
        let mut list = logs.lock().unwrap();
        list.push_back(ConnectionLog {
            time: Utc::now(),
            message: message.into(),
        });
        while list.len() > MAX_LOGS {
            list.pop_front();
        }
    }

    /// start the server: prefers 0.0.0.0:9527, then 9528, 9529... if taken
    /// returns the pairing code, or an error when every candidate port is busy
    pub async fn start(&mut self) -> Result<String, String> {
        {
            let running = self.is_running.lock().await;
            if *running {
                return Err("服务已在运行".into());
            }
        }

        let mut bound_port: Option<u16> = None;
        let mut listener: Option<TcpListener> = None;
        for port in DEFAULT_PORT..DEFAULT_PORT + MAX_PORT_ATTEMPTS {
            let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
            match TcpListener::bind(addr).await {
                Ok(l) => {
                    bound_port = Some(port);
                    listener = Some(l);
                    break;
                }
                Err(e) => {
                    eprintln!("[WebSocket] Port {} bind failed: {}", port, e);
                }
            }
        }

        let listener = match listener {
            Some(l) => l,
            None => {
                let end = DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1;
                return Err(format!(
                    "端口 {}~{} 均被占用，请关闭占用进程后重试",
                    DEFAULT_PORT, end
                ));
            }
        };
        let port = bound_port.unwrap();
        *self.port.lock().unwrap() = port;

        let code = Self::load_saved_pairing_code().unwrap_or_else(|| {
            let new = Self::gen_pairing_code();
            Self::save_pairing_code(&new);
            new
        });
        {
            let mut pc = self.pairing_code.lock().await;
            *pc = code.clone();
        }
        {
            let mut running = self.is_running.lock().await;
            *running = true;
        }

        let log_msg = format!("WebSocket server started on 0.0.0.0:{}", port);
        Self::push_log(&self.logs, log_msg.clone());
        println!("[WebSocket] {}", log_msg);

        let clients = self.clients.clone();
        let pairing_code = self.pairing_code.clone();
        let monitor = self.monitor.clone();
        let logs = self.logs.clone();
        let ack_bus = self.ack_bus.clone();
        let app_handle = self.app_handle.clone();

        let handle = tokio::spawn(async move {
            loop {
                let (stream, peer) = match listener.accept().await {
                    Ok(v) => v,
                    Err(e) => {
                        eprintln!("[WebSocket] Accept error: {}", e);
                        Self::push_log(&logs, format!("Accept error: {}", e));
                        continue;
                    }
                };

                let clients = clients.clone();
                let code = pairing_code.clone();
                let mon = monitor.clone();
                let logs = logs.clone();
                let ack = ack_bus.clone();
                let app = app_handle.clone();

                tokio::spawn(async move {
                    if let Err(e) =
                        handle_connection(stream, peer, clients, code, logs, mon, ack, app).await
                    {
                        eprintln!("[WebSocket] Connection {} error: {}", peer, e);
                    }
                });
            }
        });

        self.task_handle = Some(handle);
        Ok(code)
    }

    pub async fn stop(&mut self) {
        if let Some(h) = self.task_handle.take() {
            h.abort();
        }
        {
            let mut running = self.is_running.lock().await;
            *running = false;
        }
        {
            let mut clients = self.clients.lock().await;
            clients.clear();
        }
        let port = *self.port.lock().unwrap();
        Self::push_log(&self.logs, format!("WebSocket server stopped (was 0.0.0.0:{})", port));
        println!("[WebSocket] WebSocket server stopped");
    }

    pub async fn regenerate_pairing_code(&self) -> String {
        let code = Self::generate_and_save_pairing_code();
        {
            let mut pc = self.pairing_code.lock().await;
            *pc = code.clone();
        }
        Self::push_log(&self.logs, "配对码已重新生成");
        code
    }

    pub async fn is_running(&self) -> bool {
        *self.is_running.lock().await
    }

    pub async fn get_pairing_code(&self) -> String {
        self.pairing_code.lock().await.clone()
    }

    pub fn get_port(&self) -> u16 {
        *self.port.lock().unwrap()
    }

    /// last 20 connection logs, newest first
    pub fn get_logs(&self) -> Vec<ConnectionLog> {
        self.logs
            .lock()
            .unwrap()
            .iter()
            .rev()
            .take(20)
            .cloned()
            .collect()
    }

    pub async fn get_connections(&self) -> Vec<ClientInfo> {
        let map = self.clients.lock().await;
        map.values().map(|c| c.info.clone()).collect()
    }

    pub async fn broadcast(&self, message: &str) {
        let map = self.clients.lock().await;
        for client in map.values() {
            let _ = client.sender.send(message.to_string());
        }
    }

    /// cloned send channel of the target device (for theme pack pushes)
    pub async fn client_sender(&self, client_id: &str) -> Option<ClientSender> {
        let map = self.clients.lock().await;
        map.get(client_id).map(|c| c.sender.clone())
    }

    /// send a raw message to one device
    pub async fn send_to_client(&self, client_id: &str, message: &str) -> Result<(), String> {
        let map = self.clients.lock().await;
        match map.get(client_id) {
            Some(c) => c
                .sender
                .send(message.to_string())
                .map_err(|e| format!("发送失败: {}", e)),
            None => Err(format!("设备 {} 不在线", client_id)),
        }
    }
}

fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "iLinkCat PC".into())
}

// 4-digit pairing code is enumerable: 5-min IP ban after too many failures, plus a random delay on failure responses to slow scripts

use std::net::IpAddr;
use std::time::Instant;

const HS_FAIL_WINDOW_SECS: u64 = 60;
const HS_FAIL_MAX: u32 = 5;
const HS_BLOCK_SECS: u64 = 300;

#[derive(Clone, Copy)]
struct HsRecord {
    fails: u32,
    window_start: Instant,
    blocked_until: Option<Instant>,
}

static HANDSHAKE_GUARD: std::sync::LazyLock<std::sync::Mutex<HashMap<IpAddr, HsRecord>>> =
    std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

fn hs_gc(now: Instant, map: &mut HashMap<IpAddr, HsRecord>) {
    map.retain(|_, r| {
        r.blocked_until.map(|b| b > now).unwrap_or(false)
            || now.duration_since(r.window_start).as_secs() < HS_FAIL_WINDOW_SECS
    });
}

/// remaining ban time for the ip, None if not banned
fn handshake_blocked_remaining(ip: IpAddr) -> Option<Duration> {
    let mut map = HANDSHAKE_GUARD.lock().ok()?;
    let now = Instant::now();
    hs_gc(now, &mut map);
    let until = map.get(&ip)?.blocked_until?;
    (until > now).then(|| until.duration_since(now))
}

/// record a pairing failure, returns the random ms to sleep before responding
fn record_handshake_failure(ip: IpAddr) -> u64 {
    let mut map = match HANDSHAKE_GUARD.lock() {
        Ok(m) => m,
        Err(_) => return 0,
    };
    let now = Instant::now();
    hs_gc(now, &mut map);
    let r = map.entry(ip).or_insert(HsRecord {
        fails: 0,
        window_start: now,
        blocked_until: None,
    });
    if now.duration_since(r.window_start).as_secs() >= HS_FAIL_WINDOW_SECS {
        r.fails = 0;
        r.window_start = now;
    }
    r.fails += 1;
    if r.fails >= HS_FAIL_MAX && r.blocked_until.is_none() {
        r.blocked_until = Some(now + Duration::from_secs(HS_BLOCK_SECS));
    }
    rand::rng().random_range(200..800u64)
}

/// clear failure records after a successful pairing
fn clear_handshake_failures(ip: IpAddr) {
    if let Ok(mut map) = HANDSHAKE_GUARD.lock() {
        map.remove(&ip);
    }
}

// ─── Per-connection handler ─────────────────────────────────

async fn handle_connection(
    stream: tokio::net::TcpStream,
    peer: SocketAddr,
    clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
    pairing_code: Arc<Mutex<String>>,
    logs: Arc<std::sync::Mutex<VecDeque<ConnectionLog>>>,
    monitor: Option<Arc<Mutex<MonitorScheduler>>>,
    ack_bus: AckBus,
    app: Option<tauri::AppHandle>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tokio_tungstenite::accept_async;

    let ws = accept_async(stream).await?;
    let (mut ws_tx, mut ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // banned IPs get rejected at handshake, before any pairing check
    if let Some(remaining) = handshake_blocked_remaining(peer.ip()) {
        let err = JsonRpcResponse::error(
            ERR_RATE_LIMITED,
            &format!("Too many pairing attempts, retry after {}s", remaining.as_secs()),
            None,
        );
        let _ = ws_tx
            .send(Message::Text(serde_json::to_string(&err)?.into()))
            .await;
        // sleep briefly so the error message lands before the socket closes
        tokio::time::sleep(Duration::from_millis(150)).await;
        WebSocketServer::push_log(
            &logs,
            format!("{} 配对失败过多已封禁，剩余 {}s", peer, remaining.as_secs()),
        );
        return Ok(());
    }

    // ── Phase 1: handshake (10s timeout) ──
    let first_msg = match tokio::time::timeout(
        Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
        ws_rx.next(),
    )
    .await
    {
        Ok(Some(Ok(m))) => m,
        Ok(_) => {
            WebSocketServer::push_log(&logs, format!("{} 握手超时（未发送握手消息）", peer));
            return Ok(());
        }
        Err(_) => {
            let err = JsonRpcResponse::error(ERR_HANDSHAKE_TIMEOUT, "Handshake timeout", None);
            let _ = ws_tx
                .send(Message::Text(serde_json::to_string(&err)?.into()))
                .await;
            WebSocketServer::push_log(&logs, format!("{} 握手超时，已断开", peer));
            return Ok(());
        }
    };

    let text = match first_msg {
        Message::Text(t) => t,
        _ => return Ok(()),
    };

    let req: JsonRpcRequest = match serde_json::from_str(&text) {
        Ok(r) => r,
        Err(_) => {
            let err = JsonRpcResponse::error(-32700, "Parse error", None);
            let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
            return Ok(());
        }
    };

    if req.method != "handshake" {
        let err = JsonRpcResponse::error(-32601, "Method not found: expected handshake", req.id);
        let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
        return Ok(());
    }

    let params: HandshakeParams = match req
        .params
        .as_ref()
        .and_then(|p| serde_json::from_value(p.clone()).ok())
    {
        Some(p) => p,
        None => {
            let err = JsonRpcResponse::error(-32602, "Invalid handshake params", req.id);
            let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
            return Ok(());
        }
    };

    let current_code = {
        let code = pairing_code.lock().await;
        code.clone()
    };
    if params.pairing_code != current_code {
        let delay_ms = record_handshake_failure(peer.ip());
        let err = JsonRpcResponse::error(ERR_INVALID_PAIRING_CODE, "Invalid pairing code", req.id);
        let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
        WebSocketServer::push_log(&logs, format!("{} 拒绝连接：配对码错误", peer));
        println!("[WebSocket] Rejected {} — invalid pairing code", peer);
        // random delay to slow brute force; ban check happens on the next connection
        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        return Ok(());
    }
    clear_handshake_failures(peer.ip());

    // duplicate connection: same base device name kicks the old one
    // (covers both the main connection and its "(Display)" sibling)
    let old = {
        let map = clients.lock().await;
        map.values()
            .find(|c| base_device_name(&c.info.device_name) == base_device_name(&params.device_name))
            .map(|c| (c.info.client_id.clone(), c.sender.clone()))
    };
    if let Some((old_id, old_sender)) = old {
        let dup_err =
            JsonRpcResponse::error(ERR_DUPLICATE_CONNECTION, "Duplicate connection", None);
        let _ = old_sender.send(serde_json::to_string(&dup_err).unwrap());
        {
            let mut map = clients.lock().await;
            map.remove(&old_id);
        }
        if let Some(mon) = &monitor {
            mon.lock().await.remove_client(&old_id);
        }
        if let Some(sched) = crate::services::media_scheduler::global_media_scheduler() {
            sched.lock().await.remove_client(&old_id);
        }
        println!("[Monitor] 客户端 {} 重复连接被踢下线，已清理其推送任务", old_id);
        WebSocketServer::push_log(
            &logs,
            format!("设备 {} 重复连接，已断开旧连接", params.device_name),
        );
    } else {
        // no existing connection from this device: enforce the plan limit
        let distinct = {
            let map = clients.lock().await;
            let mut names: HashSet<&str> = HashSet::new();
            for c in map.values() {
                names.insert(base_device_name(&c.info.device_name));
            }
            names.len()
        };
        if distinct >= MAX_DEVICES {
            let err = JsonRpcResponse::error(
                ERR_DEVICE_LIMIT,
                &format!("Device limit reached ({}), disconnect the other device first", MAX_DEVICES),
                req.id,
            );
            let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
            tokio::time::sleep(Duration::from_millis(150)).await;
            WebSocketServer::push_log(
                &logs,
                format!("{} 拒绝连接：已达设备数上限（{}）", peer, MAX_DEVICES),
            );
            println!("[WebSocket] Rejected {} — device limit ({})", peer, MAX_DEVICES);
            return Ok(());
        }
    }

    let client_id = Uuid::new_v4().to_string();

    // the phone uses this list as a hint when it has no themes locally
    let theme_list: Vec<String> = crate::theme::manager::scan_themes()
        .map(|list| list.into_iter().map(|t| t.name).collect())
        .unwrap_or_default();

    let ok = HandshakeResult {
        status: "ok",
        server_version: env!("CARGO_PKG_VERSION").to_string(),
        server_name: hostname(),
        device_id: client_id.clone(),
        theme_list,
    };
    let resp = JsonRpcResponse::success(serde_json::to_value(ok)?, req.id);
    ws_tx.send(Message::Text(serde_json::to_string(&resp)?.into())).await?;

    let client_info = ClientInfo {
        client_id: client_id.clone(),
        device_name: params.device_name.clone(),
        app_version: params.app_version.clone(),
        ip_address: peer.to_string(),
        connected_at: chrono::Utc::now(),
    };

    {
        let mut map = clients.lock().await;
        map.insert(
            client_id.clone(),
            ClientHandle {
                info: client_info,
                sender: tx,
            },
        );
    }
    if let Some(app) = &app {
        let _ = app.emit("ws-clients-changed", ());
    }
    WebSocketServer::push_log(
        &logs,
        format!("设备 {} (v{}) 已连接，来源 {}", params.device_name, params.app_version, peer),
    );
    println!("[WebSocket] Client {} paired from {}", client_id, peer);

    // ── Phase 2: message pump ──

    let cid_recv = client_id.clone();
    let clients_recv = clients.clone();
    let mon_recv = monitor.clone();

    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            if let Message::Text(text) = msg {
                // try parsing it as a response (push ack) first; if AckBus claims it, done, else dispatch normally
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    let has_method = v.get("method").is_some();
                    let id_num = v.get("id").and_then(|i| i.as_u64());
                    if !has_method {
                        if let Some(id) = id_num {
                            if ack_bus.resolve(id, v.clone()) {
                                continue;
                            }
                        }
                    }
                }
                let resp = handler::dispatch(&text, &cid_recv, &clients_recv, &mon_recv).await;
                let map = clients_recv.lock().await;
                if let Some(client) = map.get(&cid_recv) {
                    let _ = client.sender.send(resp);
                }
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // ── Phase 3: cleanup ──
    // disconnect safety net: unregister every background poll/push subscription tied to
    // this connection; schedulers stop themselves when empty, no zombie tasks left spinning

    if let Some(mon) = &monitor {
        mon.lock().await.remove_client(&client_id);
    }
    if let Some(sched) = crate::services::media_scheduler::global_media_scheduler() {
        sched.lock().await.remove_client(&client_id);
    }
    {
        let mut map = clients.lock().await;
        map.remove(&client_id);
    }
    if let Some(app) = &app {
        let _ = app.emit("ws-clients-changed", ());
    }
    WebSocketServer::push_log(
        &logs,
        format!("设备 {} 已断开，已清理其推送任务", params.device_name),
    );
    println!("[Monitor] 客户端 {} 断开连接，已清理该节点的轮询与推送任务。", client_id);

    Ok(())
}
