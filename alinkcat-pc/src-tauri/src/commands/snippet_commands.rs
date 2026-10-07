use crate::services::snippet_service;
use crate::services::snippet_store::SnippetEntry;

#[tauri::command]
pub fn inject_snippet(text: String) -> Result<(), String> {
    snippet_service::inject_snippet(&text)
}

/// frontend syncs its localStorage snippets here; WS snippet.list serves them to the phone
#[tauri::command]
pub fn sync_snippets(snippets: Vec<SnippetEntry>) -> Result<(), String> {
    crate::services::snippet_store::set_all(snippets);
    Ok(())
}
