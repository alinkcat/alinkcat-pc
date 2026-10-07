use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tokio::net::TcpListener;

static INIT: AtomicBool = AtomicBool::new(false);
static CALLBACK_RESULT: OnceLock<Arc<Mutex<Option<OAuthResult>>>> = OnceLock::new();
static CALLBACK_ERROR: OnceLock<Arc<Mutex<Option<String>>>> = OnceLock::new();
static TASK_HANDLE: OnceLock<tauri::async_runtime::JoinHandle<()>> = OnceLock::new();

/// Result captured by the OAuth callback.
#[derive(Clone)]
pub struct OAuthResult {
    pub token: String,
    pub refresh_token: String,
    pub username: String,
}

/// Initialize the local OAuth callback server (called once from lib.rs).
pub fn init_oauth_callback_server() {
    if INIT.swap(true, Ordering::SeqCst) {
        return;
    }
    let result: Arc<Mutex<Option<OAuthResult>>> = Arc::new(Mutex::new(None));
    let result_clone = result.clone();
    let error_state: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let error_clone = error_state.clone();
    let _ = CALLBACK_RESULT.set(result);
    let _ = CALLBACK_ERROR.set(error_state);

    let handle = tauri::async_runtime::spawn(async move {
        let addr = "127.0.0.1:9528";
        let listener = match TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                println!("[OAuth] local callback server failed to start: {}", e);
                return;
            }
        };
        println!("[OAuth] local callback server started: http://{}/oauth/callback", addr);

        loop {
            let (mut socket, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let result = result_clone.clone();
            let error_state = error_clone.clone();
            tauri::async_runtime::spawn(async move {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = [0u8; 8192];
                let n = socket.read(&mut buf).await.unwrap_or(0);
                if n == 0 {
                    return;
                }
                let request = String::from_utf8_lossy(&buf[..n]).to_string();

                let token = extract_query_param(&request, "token");
                let refresh_token = extract_query_param(&request, "refreshToken");
                let username = extract_query_param(&request, "username");
                let error = extract_query_param(&request, "error");

                let (status, body) = if let Some(err) = error {
                    let msg = format!("authorization failed: {}", err);
                    println!("[OAuth] callback received error: {}", err);
                    {
                        let mut guard = error_state.lock().unwrap();
                        *guard = Some(err);
                    }
                    (400, format!("<html><body><h3>{}</h3></body></html>", msg))
                } else if let Some(tok) = token {
                    println!("[OAuth] received auth token (username={})", username.as_deref().unwrap_or("-"));
                    {
                        let mut guard = result.lock().unwrap();
                        *guard = Some(OAuthResult {
                            token: tok,
                            refresh_token: refresh_token.unwrap_or_default(),
                            username: username.unwrap_or_default(),
                        });
                    }
                    (200, "<html><body><h3>Authorization successful! Please close this page and return to the app.</h3></body></html>".to_string())
                } else {
                    (400, "<html><body><h3>Invalid callback request (missing token).</h3></body></html>".to_string())
                };

                let response = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status,
                    if status == 200 { "OK" } else { "Bad Request" },
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.flush().await;
            });
        }
    });

    let _ = TASK_HANDLE.set(handle);
}

/// Parse a query parameter from a raw HTTP request.
fn extract_query_param(request: &str, name: &str) -> Option<String> {
    let first_line = request.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");
    let query = path.split('?').nth(1).unwrap_or("");
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        let key = it.next().unwrap_or("").trim();
        let value = it.next().unwrap_or("").trim();
        if key == name && !value.is_empty() {
            return Some(value.replace('+', " "));
        }
    }
    None
}

/// Block until the OAuth callback token arrives or timeout_secs elapses.
pub fn wait_for_token(timeout_secs: u64) -> Result<OAuthResult, String> {
    let result = CALLBACK_RESULT.get().ok_or("callback server not initialized")?;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        {
            let guard = result.lock().unwrap();
            if let Some(oauth) = guard.as_ref() {
                return Ok(oauth.clone());
            }
        }
        if std::time::Instant::now() >= deadline {
            return Err("authorization timed out".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

/// Clear the captured token for the next login attempt.
pub fn reset_token() {
    if let Some(result) = CALLBACK_RESULT.get() {
        let mut guard = result.lock().unwrap();
        *guard = None;
    }
    if let Some(err) = CALLBACK_ERROR.get() {
        let mut guard = err.lock().unwrap();
        *guard = None;
    }
}

/// Non-blocking poll: return { "token", "refreshToken", "username" }, { "error" }, or null.
pub fn poll_token() -> Result<serde_json::Value, String> {
    if let Some(err) = CALLBACK_ERROR.get() {
        if let Some(msg) = err.lock().unwrap().as_ref() {
            return Ok(serde_json::json!({ "error": msg }));
        }
    }
    if let Some(result) = CALLBACK_RESULT.get() {
        if let Some(oauth) = result.lock().unwrap().as_ref() {
            return Ok(serde_json::json!({
                "token": oauth.token,
                "refreshToken": oauth.refresh_token,
                "username": oauth.username,
            }));
        }
    }
    Ok(serde_json::Value::Null)
}
