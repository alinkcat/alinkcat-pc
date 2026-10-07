use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::Engine;
use serde::Serialize;
use tauri::{Emitter, State};
use tokio::sync::Mutex;

use crate::commands::WsServerState;
use crate::services::hash_service;
use crate::theme::manager;
use crate::websocket::ack_bus::AckBus;
use crate::websocket::push_handler;
use crate::websocket::server::WebSocketServer;

const CHUNK_SIZE: usize = 64 * 1024; // 64KB
// phone pops a confirm dialog (ready/rejected/busy), so awaiting_confirm gets 10s
const START_TIMEOUT_SECS: u64 = 10;
const CHUNK_TIMEOUT_SECS: u64 = 8;
const CHUNK_ATTEMPTS: u32 = 3;
const BUSY_MAX_RETRIES: u32 = 5;
const BUSY_RETRY_DELAY_SECS: u64 = 3;

const ERR_START_TIMEOUT: &str =
    "\u{624b}\u{673a}\u{7aef}\u{672a}\u{54cd}\u{5e94}\u{ff0c}\u{8bf7}\u{786e}\u{8ba4}\u{624b}\u{673a} App \u{662f}\u{5426}\u{5728}\u{524d}\u{53f0}\u{8fd0}\u{884c}";
const ERR_BUSY_EXHAUSTED: &str = "\u{624b}\u{673a}\u{7aef}\u{6301}\u{7eed}\u{5fd9}\u{788c}\u{ff0c}\u{8bf7}\u{7a0d}\u{540e}\u{518d}\u{8bd5}";
const ERR_CHUNK_TIMEOUT: &str = "\u{53d1}\u{9001}\u{6570}\u{636e}\u{5757}\u{8d85}\u{65f6}\u{ff08}\u{624b}\u{673a}\u{7aef}\u{672a}\u{54cd}\u{5e94}\u{ff09}";
const ERR_REJECT_PREFIX: &str = "\u{7528}\u{6237}\u{62d2}\u{7edd}\u{63a5}\u{6536}\u{ff1a}";

static NEXT_ID: AtomicU64 = AtomicU64::new(100);

fn next_id() -> u64 {
    NEXT_ID.fetch_add(1, Ordering::Relaxed)
}

#[derive(Debug, Serialize)]
pub struct PackedTheme {
    #[serde(rename = "themeId")]
    pub theme_id: String,
    pub name: String,
    pub version: String,
    pub size: u64,
    pub hash: String,
    pub base64: String,
}

#[derive(Debug, Serialize)]
pub struct PushResult {
    pub started: bool,
    #[serde(rename = "themeId")]
    pub theme_id: String,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    #[serde(rename = "totalChunks")]
    pub total_chunks: u32,
    pub hash: String,
}

pub struct AckBusState {
    pub bus: AckBus,
    /// in-flight push tasks, key: (client_id, theme_id); cancel_push aborts via this
    pub push_tasks: std::sync::Mutex<std::collections::HashMap<(String, String), tokio::task::JoinHandle<()>>>,
}

enum AckOutcome {
    Ok,
    Busy,
    Rejected(String),
    Error(String),
    Timeout,
}

fn add_dir<W: io::Write + io::Seek>(
    zip: &mut zip::ZipWriter<W>,
    dir: &Path,
    base: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        if path.is_dir() {
            zip.add_directory(format!("{}/", name), options)
                .map_err(|e| e.to_string())?;
            add_dir(zip, &path, base, options)?;
        } else {
            zip.start_file(&name, options).map_err(|e| e.to_string())?;
            let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
            io::copy(&mut f, zip).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// pack a theme into .alc (in-memory zip), return base64 + size + sha-256
#[tauri::command]
pub fn pack_theme_data(theme_id: String) -> Result<PackedTheme, String> {
    let dir = manager::get_theme_dir(&theme_id)?;
    let meta = manager::read_theme_meta_pub(&dir)?;

    // make sure a cover exists, generate a placeholder otherwise
    let cover = dir.join("cover.png");
    if !cover.exists() {
        manager::write_default_cover(&dir, &meta.name)?;
    }

    let mut buffer: Vec<u8> = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(io::Cursor::new(&mut buffer));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        add_dir(&mut zip, &dir, &dir, options)?;
        zip.finish().map_err(|e| e.to_string())?;
    }

    let size = buffer.len() as u64;
    let hash = hash_service::sha256_bytes(&buffer);
    let base64 = base64::engine::general_purpose::STANDARD.encode(&buffer);

    Ok(PackedTheme {
        theme_id,
        name: meta.name,
        version: meta.version,
        size,
        hash,
        base64,
    })
}

/// push a theme pack to a device in chunks (ack/timeout/busy retry + resume)
/// start_chunk > 0 resumes from that chunk (skips the start handshake)
#[tauri::command]
pub async fn push_theme_to_device(
    app: tauri::AppHandle,
    server_state: State<'_, WsServerState>,
    ack_state: State<'_, AckBusState>,
    theme_id: String,
    client_id: String,
    start_chunk: Option<u32>,
) -> Result<PushResult, String> {
    let packed = pack_theme_data(theme_id.clone())?;
    let total_chunks = ((packed.base64.len() + CHUNK_SIZE - 1) / CHUNK_SIZE) as u32;
    if total_chunks == 0 {
        return Err("主题包为空".to_string());
    }
    let start_chunk = start_chunk.unwrap_or(0).min(total_chunks.saturating_sub(1));

    let result = PushResult {
        started: true,
        theme_id: theme_id.clone(),
        total_size: packed.size,
        total_chunks,
        hash: packed.hash.clone(),
    };

    let server: Arc<Mutex<WebSocketServer>> = server_state.inner().server.clone();
    let ack = ack_state.bus.clone();
    let app2 = app.clone();
    let client_id2 = client_id.clone();
    let name = packed.name.clone();
    let version = packed.version.clone();
    let size = packed.size;
    let hash = packed.hash.clone();
    let base64 = packed.base64.clone();
    let theme_id2 = theme_id.clone();

    let task = tokio::spawn(async move {
        let outcome = run_push(
            &server,
            &ack,
            &client_id2,
            &theme_id2,
            &name,
            &version,
            &base64,
            size,
            hash,
            total_chunks,
            start_chunk,
            &app2,
        )
        .await;
        match outcome {
            Ok(()) => {
                let _ = app2.emit("theme-push-complete", serde_json::json!({
                    "themeId": theme_id2, "status": "success"
                }));
            }
            Err(e) => {
                // user-initiated cancel: don't emit an error, the frontend already knows
                if e != "cancelled" {
                    let _ = app2.emit("theme-push-failed", serde_json::json!({
                        "themeId": theme_id2, "error": e
                    }));
                }
            }
        }
    });

    // register the task handle so cancel_push can abort it
    ack_state.push_tasks.lock().unwrap().insert((client_id, theme_id), task);

    Ok(result)
}

/// send one message and wait for the phone's ack (custom timeout); classify busy / reject / error
async fn send_and_await(
    server: &Arc<Mutex<WebSocketServer>>,
    ack: &AckBus,
    client_id: &str,
    msg: &serde_json::Value,
    req_id: u64,
    timeout_secs: u64,
) -> AckOutcome {
    let rx = ack.register(req_id);
    {
        let s = server.lock().await;
        match s.client_sender(client_id).await {
            Some(sender) => {
                if sender.send(msg.to_string()).is_err() {
                    return AckOutcome::Error("设备已断开".to_string());
                }
            }
            None => return AckOutcome::Error("设备不在线".to_string()),
        }
    }
    match tokio::time::timeout(Duration::from_secs(timeout_secs), rx).await {
        Ok(Ok(v)) => {
            // phone replies with result.status = "ready" / "busy" / "reject"
            if let Some(status) = v
                .get("result")
                .and_then(|r| r.get("status"))
                .and_then(|s| s.as_str())
            {
                match status {
                    "busy" => return AckOutcome::Busy,
                    "reject" | "rejected" => return AckOutcome::Rejected("用户拒绝接收".to_string()),
                    _ => return AckOutcome::Ok, // generic ack
                }
            }
            if let Some(err) = push_handler::extract_error(&v) {
                if err.to_lowercase().contains("reject") {
                    return AckOutcome::Rejected(err);
                }
                return AckOutcome::Error(err);
            }
            AckOutcome::Ok
        }
        Ok(Err(_)) => AckOutcome::Error("确认通道关闭".to_string()),
        Err(_) => AckOutcome::Timeout,
    }
}

/// send theme.push.start; on busy wait 3s and retry (max 5 times)
async fn send_start(
    server: &Arc<Mutex<WebSocketServer>>,
    ack: &AckBus,
    client_id: &str,
    theme_id: &str,
    name: &str,
    version: &str,
    size: u64,
    total_chunks: u32,
    hash: &str,
) -> Result<(), String> {
    let mut busy_retries = 0u32;
    loop {
        let req_id = next_id();
        let msg = push_handler::push_start(req_id, theme_id, name, version, size, total_chunks, hash);
        match send_and_await(server, ack, client_id, &msg, req_id, START_TIMEOUT_SECS).await {
            AckOutcome::Ok => return Ok(()),
            AckOutcome::Busy => {
                busy_retries += 1;
                if busy_retries >= BUSY_MAX_RETRIES {
                    return Err(ERR_BUSY_EXHAUSTED.to_string());
                }
                tokio::time::sleep(Duration::from_secs(BUSY_RETRY_DELAY_SECS)).await;
            }
            AckOutcome::Rejected(m) => return Err(format!("{}{}", ERR_REJECT_PREFIX, m)),
            AckOutcome::Error(m) => return Err(m),
            AckOutcome::Timeout => return Err(ERR_START_TIMEOUT.to_string()),
        }
    }
}

/// send one chunk with retries; busy backs off 3s before retrying
async fn send_chunk(
    server: &Arc<Mutex<WebSocketServer>>,
    ack: &AckBus,
    client_id: &str,
    theme_id: &str,
    index: u32,
    data: &str,
    is_last: bool,
) -> Result<(), String> {
    let mut attempts = 0u32;
    loop {
        let req_id = next_id();
        let msg = push_handler::push_chunk(req_id, theme_id, index, data, is_last);
        match send_and_await(server, ack, client_id, &msg, req_id, CHUNK_TIMEOUT_SECS).await {
            AckOutcome::Ok => return Ok(()),
            AckOutcome::Busy => {
                attempts += 1;
                if attempts >= CHUNK_ATTEMPTS {
                    return Err(ERR_BUSY_EXHAUSTED.to_string());
                }
                tokio::time::sleep(Duration::from_secs(BUSY_RETRY_DELAY_SECS)).await;
            }
            AckOutcome::Rejected(m) => return Err(format!("{}{}", ERR_REJECT_PREFIX, m)),
            AckOutcome::Error(m) => return Err(m),
            AckOutcome::Timeout => {
                attempts += 1;
                if attempts >= CHUNK_ATTEMPTS {
                    return Err(ERR_CHUNK_TIMEOUT.to_string());
                }
            }
        }
    }
}

async fn run_push(
    server: &Arc<Mutex<WebSocketServer>>,
    ack: &AckBus,
    client_id: &str,
    theme_id: &str,
    name: &str,
    version: &str,
    base64: &str,
    size: u64,
    hash: String,
    total_chunks: u32,
    start_chunk: u32,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    // start_chunk is kept for caller compat, but the phone does full-overwrite receive:
    // it always needs the start handshake and a retry means a full resend (no mid-stream resume, avoids .part mismatch)
    let _ = start_chunk;

    // 1. start ack (awaiting_confirm: 10s timeout + ready/busy/reject handling)
    send_start(server, ack, client_id, theme_id, name, version, size, total_chunks, &hash).await?;

    // 2. chunks (8s timeout per chunk, 3 attempts; full send from chunk 0)
    let t0 = Instant::now();
    let mut bytes_sent: u64 = 0;
    for i in 0..total_chunks {
        let start = i as usize * CHUNK_SIZE;
        let end = std::cmp::min(start + CHUNK_SIZE, base64.len());
        let chunk = &base64[start..end];
        send_chunk(server, ack, client_id, theme_id, i, chunk, i == total_chunks - 1).await?;

        // chunks are base64 strings, real bytes = chars * 3/4 (progress tracks actual bytes)
        bytes_sent += (chunk.len() as u64) * 3 / 4;
        let elapsed = t0.elapsed().as_secs_f64().max(0.001);
        let speed = (bytes_sent as f64 / 1024.0) / elapsed; // KB/s
        let progress = if size > 0 {
            (bytes_sent as f64 / size as f64 * 100.0).min(100.0).round()
        } else {
            100.0
        };
        let _ = app.emit("theme-push-progress", serde_json::json!({
            "themeId": theme_id,
            "progress": progress,
            "sentSize": bytes_sent,
            "totalSize": size,
            "speed": speed.round(),
            "currentChunk": i,
            "totalChunks": total_chunks,
            "resumed": false
        }));
    }

    // 3. complete: no explicit success ack from the phone (fail/timeout/reject/busy) counts as failure
    let done_id = next_id();
    let done_msg = push_handler::push_complete(done_id, theme_id, "success");
    match send_and_await(server, ack, client_id, &done_msg, done_id, CHUNK_TIMEOUT_SECS).await {
        AckOutcome::Ok => {}
        AckOutcome::Error(m) => return Err(m),
        AckOutcome::Rejected(m) => return Err(format!("{}{}", ERR_REJECT_PREFIX, m)),
        AckOutcome::Busy => return Err("手机端忙碌，未确认安装结果".to_string()),
        AckOutcome::Timeout => {
            return Err("手机端未确认安装结果（可能接收中断，请重新推送）".to_string())
        }
    }

    Ok(())
}

/// cancel the push and notify the phone
#[tauri::command]
pub async fn cancel_push(
    server_state: State<'_, WsServerState>,
    ack_state: State<'_, AckBusState>,
    theme_id: String,
    client_id: String,
) -> Result<(), String> {
    // 1) abort the rust-side push task first (stop sending chunks)
    if let Some(handle) = ack_state.push_tasks.lock().unwrap().remove(&(client_id.clone(), theme_id.clone())) {
        handle.abort();
    }
    // 2) notify the phone (best-effort, it may already be disconnected)
    let msg = push_handler::push_cancel(next_id(), &theme_id, "user_cancelled");
    let s = server_state.server.lock().await;
    let _ = s.send_to_client(&client_id, &msg.to_string()).await;
    Ok(())
}
