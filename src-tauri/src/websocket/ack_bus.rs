use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio::sync::oneshot;

#[derive(Default)]
struct AckBusInner {
    pending: HashMap<u64, oneshot::Sender<serde_json::Value>>,
}

/// push request id -> oneshot waiting for the phone's ack
/// the connection recv loop resolves matching ids, everything else goes through normal JSON-RPC dispatch
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

    /// true if a pending request id was consumed
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
