use std::collections::{HashMap, VecDeque};
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
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

pub struct WebSocketServer {
    pub clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
    pub pairing_code: Arc<Mutex<String>>,
    pub is_running: Arc<Mutex<bool>>,
    pub port: Arc<std::sync::Mutex<u16>>,
    pub logs: Arc<std::sync::Mutex<VecDeque<ConnectionLog>>>,
    pub monitor: Option<Arc<Mutex<MonitorScheduler>>>,
    pub ack_bus: AckBus,
    task_handle: Option<tokio::task::JoinHandle<()>>,
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
            task_handle: None,
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

    /// Starts the service, preferring 0.0.0.0:9527 and then trying 9528, 9529, and so on if occupied.
    /// Returns this session's pairing code, or an error if all candidate ports are occupied.
    pub async fn start(&mut self) -> Result<String, String> {
        {
            let running = self.is_running.lock().await;
            if *running {
                return Err("service already running".into());
            }
        }

        // Handle port conflicts by trying each port starting at 9527
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
                    "ports {}~{} are all in use; close the occupying process and retry",
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

                tokio::spawn(async move {
                    if let Err(e) =
                        handle_connection(stream, peer, clients, code, logs, mon, ack).await
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
        Self::push_log(&self.logs, "Pairing code regenerated");
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

    /// Returns the 20 most recent connection logs, newest first.
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

    /// Gets a clone of the target device's sender channel (for theme package pushes).
    pub async fn client_sender(&self, client_id: &str) -> Option<ClientSender> {
        let map = self.clients.lock().await;
        map.get(client_id).map(|c| c.sender.clone())
    }

    /// Sends a raw message to the target device.
    pub async fn send_to_client(&self, client_id: &str, message: &str) -> Result<(), String> {
        let map = self.clients.lock().await;
        match map.get(client_id) {
            Some(c) => c
                .sender
                .send(message.to_string())
                .map_err(|e| format!("send failed: {}", e)),
            None => Err(format!("device {} offline", client_id)),
        }
    }
}

fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "iLinkCat PC".into())
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
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tokio_tungstenite::accept_async;

    let ws = accept_async(stream).await?;
    let (mut ws_tx, mut ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // ── Phase 1: Handshake (10-second timeout) ──
    let first_msg = match tokio::time::timeout(
        Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
        ws_rx.next(),
    )
    .await
    {
        Ok(Some(Ok(m))) => m,
        Ok(_) => {
            WebSocketServer::push_log(&logs, format!("{} handshake timeout (no handshake message sent)", peer));
            return Ok(());
        }
        Err(_) => {
            let err = JsonRpcResponse::error(ERR_HANDSHAKE_TIMEOUT, "Handshake timeout", None);
            let _ = ws_tx
                .send(Message::Text(serde_json::to_string(&err)?.into()))
                .await;
            WebSocketServer::push_log(&logs, format!("{} handshake timeout, disconnected", peer));
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
        let msg = format!("Method not found: expected handshake, got '{}'", req.method);
        let err = JsonRpcResponse::error(-32601, &msg, req.id);
        let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
        WebSocketServer::push_log(&logs, format!("{} rejected: {}", peer, msg));
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

    // Validate the pairing code
    let current_code = {
        let code = pairing_code.lock().await;
        code.clone()
    };
    if params.pairing_code != current_code {
        let err = JsonRpcResponse::error(ERR_INVALID_PAIRING_CODE, "Invalid pairing code", req.id);
        let _ = ws_tx.send(Message::Text(serde_json::to_string(&err)?.into())).await;
        WebSocketServer::push_log(&logs, format!("{} connection rejected: pairing code mismatch", peer));
        println!("[WebSocket] Rejected {} — invalid pairing code", peer);
        return Ok(());
    }

    // Handle duplicate connections by disconnecting the old connection for the same device
    let old = {
        let map = clients.lock().await;
        map.values()
            .find(|c| c.info.device_name == params.device_name)
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
        println!("[Monitor] client {} duplicate connection kicked, cleaned up its push tasks", old_id);
        WebSocketServer::push_log(
            &logs,
            format!("device {} duplicate connection, old connection closed", params.device_name),
        );
    }

    let client_id = Uuid::new_v4().to_string();

    let ok = HandshakeResult {
        status: "ok",
        server_version: env!("CARGO_PKG_VERSION").to_string(),
        server_name: hostname(),
        device_id: client_id.clone(),
        theme_list: vec!["default".into(), "dark".into()],
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
    WebSocketServer::push_log(
        &logs,
        format!("device {} (v{}) connected, from {}", params.device_name, params.app_version, peer),
    );
    println!("[WebSocket] Client {} paired from {}", client_id, peer);

    // Auto-subscribe to monitor + media so data flows immediately.
    // The phone may not send theme.enter / monitor.subscribe reliably on reconnect.
    if let Some(mon) = &monitor {
        let mut m = mon.lock().await;
        m.subscribe(
            &client_id,
            ["cpu", "memory", "network", "disk", "uptime", "battery"]
                .iter()
                .map(|s| s.to_string())
                .collect(),
        );
        m.start();
    }
    if let Some(sched) = crate::services::media_scheduler::global_media_scheduler() {
        let mut s = sched.lock().await;
        s.subscribe(&client_id, vec!["media".into()]);
    }

    // ── Phase 2: Bidirectional message pump ──

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
                // First parse as a response (push acknowledgment); consume it if it matches AckBus, otherwise dispatch normally
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

    // ── Phase 3: Cleanup ──
    // Fallback cleanup on disconnect: remove all background polling/push subscriptions for this connection.
    // When no subscribers remain, the scheduler stops automatically to prevent zombie tasks from spinning in the background.

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
    WebSocketServer::push_log(
        &logs,
        format!("device {} disconnected, cleaned up its push tasks", params.device_name),
    );
    println!("[Monitor] client {} disconnected, cleaned up polling and push tasks for this node。", client_id);

    Ok(())
}
