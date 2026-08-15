use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::oneshot;

#[derive(Default)]
struct AckBusInner {
    pending: HashMap<u64, oneshot::Sender<serde_json::Value>>,
}

/// 推送请求 ID → 等待手机端确认的 oneshot 通道。
/// 连接接收循环收到响应时，若 ID 匹配则 resolve，否则走正常 JSON-RPC 分发。
#[derive(Clone, Default)]
pub struct AckBus(Arc<Mutex<AckBusInner>>);

impl AckBus {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, id: u64) -> oneshot::Receiver<serde_json::Value> {
        let (tx, rx) = oneshot::channel();
        self.0.lock().unwrap().pending.insert(id, tx);
        rx
    }

    /// 返回是否成功消费了一个等待中的请求 ID。
    pub fn resolve(&self, id: u64, value: serde_json::Value) -> bool {
        if let Some(tx) = self.0.lock().unwrap().pending.remove(&id) {
            let _ = tx.send(value);
            true
        } else {
            false
        }
    }

    #[allow(dead_code)]
    pub fn cancel(&self, id: u64) {
        self.0.lock().unwrap().pending.remove(&id);
    }
}
