use std::sync::{Mutex, OnceLock};

/// data source for the phone's snippet.list, synced from the frontend via sync_snippets
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SnippetEntry {
    pub id: String,
    pub label: String,
    pub content: String,
}

static STORE: OnceLock<Mutex<Vec<SnippetEntry>>> = OnceLock::new();

fn store() -> &'static Mutex<Vec<SnippetEntry>> {
    STORE.get_or_init(|| Mutex::new(Vec::new()))
}

/// full overwrite sync (frontend calls this after every edit)
pub fn set_all(items: Vec<SnippetEntry>) {
    if let Ok(mut guard) = store().lock() {
        *guard = items;
    }
}

pub fn list() -> Vec<SnippetEntry> {
    store().lock().map(|g| g.clone()).unwrap_or_default()
}
