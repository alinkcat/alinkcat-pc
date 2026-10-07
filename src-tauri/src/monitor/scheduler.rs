use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use std::time::Duration;

use super::collector::Collector;
use super::types::PerfSnapshot;
use crate::websocket::server::ClientHandle;
use tokio::task::JoinHandle;

const ALL_SOURCES: &[&str] = &["cpu", "memory", "network", "disk", "uptime", "battery"];

pub struct MonitorScheduler {
    clients: Arc<tokio::sync::Mutex<HashMap<String, ClientHandle>>>,
    subscriptions: Arc<StdMutex<HashMap<String, HashSet<String>>>>,
    latest_snapshot: PerfSnapshot,
    collector: Collector,
    interval_ms: u64,
    running: bool,
    task_handle: Option<JoinHandle<()>>,
    stop_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MonitorScheduler {
    pub fn new(clients: Arc<tokio::sync::Mutex<HashMap<String, ClientHandle>>>) -> Self {
        Self {
            clients,
            subscriptions: Arc::new(StdMutex::new(HashMap::new())),
            latest_snapshot: PerfSnapshot::default(),
            collector: Collector::new(),
            interval_ms: 1000,
            running: false,
            task_handle: None,
            stop_tx: None,
        }
    }

    pub fn start(&mut self) {
        if self.running {
            return;
        }
        self.running = true;

        let clients = self.clients.clone();
        let subscriptions = self.subscriptions.clone();
        let interval = Duration::from_millis(self.interval_ms);
        let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();
        self.stop_tx = Some(stop_tx);

        let mut collector = Collector::new();

        let handle = tokio::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            let mut first = true;
            let mut tick_n: u32 = 0;

            loop {
                tokio::select! {
                    _ = &mut stop_rx => break,
                    _ = ticker.tick() => {},
                }
                tick_n += 1;

                let snapshot = {
                    let map = clients.lock().await;
                    if map.is_empty() {
                        if first {
                            first = false;
                        }
                        continue;
                    }
                    let mut all_sources = HashSet::new();
                    for s in ALL_SOURCES {
                        all_sources.insert(s.to_string());
                    }
                    collector.collect(&all_sources)
                };

                // Push to all connected clients
                let upload = snapshot
                    .network
                    .as_ref()
                    .map(|n| format!("{:.1} KB/s", n.upload))
                    .unwrap_or_default();
                let download = snapshot
                    .network
                    .as_ref()
                    .map(|n| format!("{:.1} KB/s", n.download))
                    .unwrap_or_default();

                let battery_level = snapshot.battery.as_ref().map(|b| b.level);

                let msg = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "monitor.update",
                    "params": {
                        "cpu": snapshot.cpu,
                        "memory": snapshot.memory,
                        "disk": snapshot.disk,
                        "upload": upload,
                        "download": download,
                        "uptime": snapshot.uptime,
                        "battery": battery_level
                    }
                });
                let payload = serde_json::to_string(&msg).unwrap_or_default();

                let map = clients.lock().await;
                let subs = subscriptions.lock().unwrap();
                let sub_count = subs.len();
                let client_count = map.len();
                let mut pushed = 0;
                for (client_id, client) in map.iter() {
                    if subs.contains_key(client_id) {
                        if client.sender.send(payload.clone()).is_ok() {
                            pushed += 1;
                        }
                    }
                }
                eprintln!(
                    "[Monitor] tick={} clients={} subs={} pushed={} cpu={:?} mem={:?} batt={:?}",
                    tick_n, client_count, sub_count, pushed,
                    snapshot.cpu, snapshot.memory, snapshot.battery.as_ref().map(|b| b.level)
                );
            }
        });

        self.task_handle = Some(handle);
        println!("[Monitor] Started (interval {}ms)", self.interval_ms);
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
        self.subscriptions.lock().unwrap().clear();
        println!("[Monitor] Stopped");
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    pub fn get_snapshot(&self) -> PerfSnapshot {
        self.latest_snapshot.clone()
    }

    pub fn take_snapshot_now(&mut self) -> PerfSnapshot {
        let mut sources = HashSet::new();
        for s in ALL_SOURCES {
            sources.insert(s.to_string());
        }
        let snap = self.collector.collect(&sources);
        self.latest_snapshot = snap.clone();
        snap
    }

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
        // Stop the scheduler when there are no subscribers to avoid idle background work
        if !self.has_subscribers() {
            self.stop();
        }
    }

    pub fn remove_client(&mut self, client_id: &str) {
        let mut subs = self.subscriptions.lock().unwrap();
        subs.remove(client_id);
        drop(subs);
        // Stop polling immediately after disconnect when no subscribers remain to prevent an orphaned idle task
        if !self.has_subscribers() {
            self.stop();
        }
    }

    pub fn has_subscribers(&self) -> bool {
        let subs = self.subscriptions.lock().unwrap();
        !subs.is_empty()
    }
}
