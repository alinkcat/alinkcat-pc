use crate::services::snippet_service;

#[tauri::command]
pub fn inject_snippet(text: String) -> Result<(), String> {
    snippet_service::inject_snippet(&text)
}