use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex, OnceLock};
use std::time::Duration;

use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::media_service::{self, MediaInfo};
use crate::websocket::server::ClientHandle;

static INIT: AtomicBool = AtomicBool::new(false);
static GLOBAL_CLIENTS: OnceLock<Arc<Mutex<HashMap<String, ClientHandle>>>> = OnceLock::new();
static GLOBAL_SCHED: OnceLock<Arc<Mutex<MediaScheduler>>> = OnceLock::new();

/// 初始化全局 MediaScheduler（在 lib.rs 中同步调用）。
pub fn init_global_media_scheduler(clients: Arc<Mutex<HashMap<String, ClientHandle>>>) {
    let sched = Arc::new(Mutex::new(MediaScheduler::new(clients.clone())));
    let _ = GLOBAL_CLIENTS.set(clients);
    let _ = GLOBAL_SCHED.set(sched);
    INIT.store(true, Ordering::SeqCst);
}

pub fn global_media_scheduler() -> Option<Arc<Mutex<MediaScheduler>>> {
    if INIT.load(Ordering::SeqCst) {
        GLOBAL_SCHED.get().cloned()
    } else {
        None
    }
}

/// 上次推送的关键字段快照，用于变化检测。
#[derive(Clone, PartialEq)]
struct MediaSnapshot {
    title: String,
    artist: String,
    is_playing: bool,
}

impl From<&MediaInfo> for MediaSnapshot {
    fn from(info: &MediaInfo) -> Self {
        Self {
            title: info.title.clone(),
            artist: info.artist.clone(),
            is_playing: info.is_playing,
        }
    }
}

pub struct MediaScheduler {
    clients: Arc<Mutex<HashMap<String, ClientHandle>>>,
    /// 客户端级订阅表：client_id -> 已订阅的来源集合。
    subscriptions: Arc<StdMutex<HashMap<String, HashSet<String>>>>,
    running: bool,
    task_handle: Option<JoinHandle<()>>,
    stop_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MediaScheduler {
    pub fn new(clients: Arc<Mutex<HashMap<String, ClientHandle>>>) -> Self {
        Self {
            clients,
            subscriptions: Arc::new(StdMutex::new(HashMap::new())),
            running: false,
            task_handle: None,
            stop_tx: None,
        }
    }

    /// 客户端订阅媒体推送；若调度器未运行则立即启动。
    pub fn subscribe(&mut self, client_id: &str, sources: Vec<String>) {
        if !self.running {
            self.start();
        }
        let mut subs = self.subscriptions.lock().unwrap();
        let entry = subs.entry(client_id.to_string()).or_default();
        for s in sources {
            entry.insert(s);
        }
    }

    /// 客户端取消订阅；若再无订阅者则自动停止调度器。
    pub fn unsubscribe(&mut self, client_id: &str, sources: Vec<String>) {
        let mut subs = self.subscriptions.lock().unwrap();
        if let Some(entry) = subs.get_mut(client_id) {
            for s in sources {
                entry.remove(&s);
            }
            if entry.is_empty() {
                subs.remove(client_id);
            }
        }
        drop(subs);
        if !self.has_subscribers() {
            self.stop();
        }
    }

    /// 连接断开时清理该客户端的订阅；若无订阅者则自动停止调度器，防止孤儿任务空转。
    pub fn remove_client(&mut self, client_id: &str) {
        let mut subs = self.subscriptions.lock().unwrap();
        subs.remove(client_id);
        drop(subs);
        if !self.has_subscribers() {
            self.stop();
        }
    }

    pub fn has_subscribers(&self) -> bool {
        !self.subscriptions.lock().unwrap().is_empty()
    }

    pub fn start(&mut self) {
        if self.running {
            return;
        }
        self.running = true;
        let clients = self.clients.clone();
        let subscriptions = self.subscriptions.clone();
        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();
        self.stop_tx = Some(stop_tx);

        let handle = tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_secs(2));
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            let mut last: Option<MediaSnapshot> = None;

            loop {
                tokio::select! {
                    _ = &mut stop_rx => break,
                    _ = ticker.tick() => {},
                }

                let info = match media_service::get_media_info().await {
                    Ok(i) => i,
                    Err(e) => {
                        println!("[MediaDebug] 媒体状态获取失败: {}", e);
                        continue;
                    }
                };

                let snap = MediaSnapshot::from(&info);
                if last.as_ref() == Some(&snap) {
                    continue; // 无变化，跳过推送（服务层已打印抓取日志）
                }
                last = Some(snap);

                let msg = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "media.update",
                    "params": {
                        "title": info.title,
                        "artist": info.artist,
                        "album": info.album,
                        "isPlaying": info.is_playing,
                        "position": info.position,
                        "duration": info.duration,
                        "thumbnail": info.thumbnail,
                        "displayMode": info.display_mode,
                    }
                });
                let payload = serde_json::to_string(&msg).unwrap_or_default();

                // 仅向已订阅该来源的客户端推送
                let map = clients.lock().await;
                let subs = subscriptions.lock().unwrap();
                let mut recipients = 0usize;
                for (client_id, client) in map.iter() {
                    if subs.contains_key(client_id) {
                        if client.sender.send(payload.clone()).is_ok() {
                            recipients += 1;
                        }
                    }
                }
                println!(
                    "[MediaScheduler] Pushed media.update to {} subscriber(s): {} - {}",
                    recipients, info.title, info.artist
                );
            }
        });
        self.task_handle = Some(handle);
        println!("[MediaScheduler] Started");
    }

    pub fn stop(&mut self) {
        if !self.running {
            return;
        }
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }
        if let Some(h) = self.task_handle.take() {
            h.abort();
        }
        self.running = false;
        println!("[MediaScheduler] Stopped");
    }
}
