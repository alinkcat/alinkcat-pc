mod action;
mod commands;
mod monitor;
mod services;
mod theme;
mod websocket;

use std::sync::Arc;

use commands::theme_push_commands::AckBusState;
use commands::{MonitorState, WsServerState};
use monitor::scheduler::MonitorScheduler;
use services::media_scheduler;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tokio::sync::Mutex;
use websocket::ack_bus::AckBus;
use websocket::server::WebSocketServer;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize bundled themes → ~/.ilinkcat/themes/
    theme::manager::init_themes();

    let clients = Arc::new(Mutex::new(std::collections::HashMap::new()));

    let monitor = Arc::new(Mutex::new(MonitorScheduler::new(clients.clone())));
    let ack_bus = AckBus::new();

    let mut ws_server = WebSocketServer::new();
    ws_server.set_clients(clients.clone());
    ws_server.set_monitor(monitor.clone());
    ws_server.set_ack_bus(ack_bus.clone());
    media_scheduler::init_global_media_scheduler(clients.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WsServerState {
            server: Arc::new(Mutex::new(ws_server)),
        })
        .manage(MonitorState {
            scheduler: Mutex::new(MonitorScheduler::new(clients)),
        })
        .manage(AckBusState { bus: ack_bus })
        .setup(|app| {
            // 启动本地 OAuth 回调服务器（系统浏览器授权回调用）
            services::oauth_callback_server::init_oauth_callback_server();

            // 应用启动时自动启动 WebSocket 服务
            let server = app.state::<WsServerState>().server.clone();
            tauri::async_runtime::spawn(async move {
                let mut server = server.lock().await;
                let _ = server.start().await;
            });

            // 系统托盘（关闭窗口时最小化到托盘）
            let show = MenuItemBuilder::with_id("show", "显示主界面").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出应用").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&quit)
                .build()?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止关闭，改为隐藏到托盘
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // WebSocket
            commands::start_server,
            commands::stop_server,
            commands::get_connections,
            commands::broadcast,
            // 诊断
            commands::get_server_status,
            commands::get_connection_logs,
            commands::get_pairing_code,
            commands::regenerate_pairing_code,
            commands::get_local_ip,
            // Theme
            commands::scan_themes,
            commands::load_theme,
            commands::activate_theme,
            commands::get_active_theme,
            commands::import_theme,
            commands::delete_theme,
            commands::import_theme_from_file,
            commands::download_theme_file,
            commands::oauth_reset,
            commands::oauth_wait_token,
            commands::oauth_poll,
            commands::list_theme_files,
            commands::api_request,
            commands::get_device_code,
            commands::save_theme,
            commands::export_theme,
            commands::get_theme_path,
            // Image
            commands::save_image,
            commands::save_icon,
            commands::get_image,
            commands::delete_image,
            // Upload
            commands::upload_commands::get_upload_records,
            commands::upload_commands::get_upload_status,
            commands::upload_commands::calculate_file_hash,
            commands::upload_commands::submit_theme_for_review,
            commands::upload_commands::update_upload_status,
            commands::upload_commands::delete_upload_record,
            // Theme Push
            commands::theme_push_commands::pack_theme_data,
            commands::theme_push_commands::push_theme_to_device,
            commands::theme_push_commands::cancel_push,
            commands::send_ws_message,
            // Media
            commands::media_commands::get_media_info,
            commands::media_commands::execute_media_action,
            commands::media_commands::get_current_media,
            // Action
            commands::execute_action,
            // Monitor
            commands::start_monitor,
            commands::stop_monitor,
            commands::get_current_snapshot,
            // WebView
            commands::webview_commands::fetch_rss,
            commands::webview_commands::fetch_json,
            commands::webview_commands::fetch_bilibili_room,
            commands::webview_commands::fetch_weather,
            // Launcher
            commands::launcher_commands::get_launchers,
            commands::launcher_commands::add_launcher,
            commands::launcher_commands::remove_launcher,
            commands::launcher_commands::open_launcher,
            commands::launcher_commands::resolve_launcher_path,
            commands::launcher_commands::extract_app_icon,
            // Snippet
            commands::snippet_commands::inject_snippet,
            // Calendar / Lunar
            commands::calendar_commands::get_lunar_info,
            commands::calendar_commands::get_calendar_widget_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
