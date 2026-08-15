use crate::services::media_service;

#[tauri::command]
pub async fn get_media_info() -> Result<media_service::MediaInfo, String> {
    media_service::get_media_info().await
}

#[tauri::command]
pub async fn execute_media_action(action: String, volume_level: Option<f64>) -> Result<(), String> {
    media_service::execute_media_action(&action, volume_level).await
}

/// 主动拉取当前媒体状态（等价于 WebSocket 的 media.get_current）。
#[tauri::command]
pub async fn get_current_media() -> Result<media_service::MediaInfo, String> {
    media_service::get_media_info().await
}