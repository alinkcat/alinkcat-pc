// WebView fetch requests to third-party AI services are blocked by CORS, so POST
// from Rust and stream SSE deltas to the frontend via Tauri events (ai-chunk / ai-done / ai-error).
use std::collections::HashMap;

use futures_util::StreamExt;
use tauri::{command, AppHandle, Emitter};

#[command]
pub async fn ai_chat_stream(
    app: AppHandle,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: String,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        // Prevent hanging when the upstream AI service is unresponsive: connection, request, and read timeouts.
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| {
            let _ = app.emit("ai-error", format!("failed to create HTTP client: {}", e));
            e.to_string()
        })?;
    let mut req = client.post(&url).header("Content-Type", "application/json");
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(&k, &v);
        }
    }
    let resp = req
        .body(body)
        .send()
        .await
        .map_err(|e| {
            let _ = app.emit("ai-error", format!("network request failed: {}", e));
            e.to_string()
        })?;

    if resp.status() == 401 {
        let _ = app.emit("ai-error", "API key invalid, please configure in settings");
        return Ok(());
    }
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let msg = if text.is_empty() {
            format!("AI service unavailable ({})", status)
        } else {
            format!("AI service unavailable ({}) {}", status, &text[..text.len().min(200)])
        };
        let _ = app.emit("ai-error", msg);
        return Ok(());
    }

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buf.push_str(&String::from_utf8_lossy(&chunk));
        // Parse SSE line by line; keep lines spanning chunk boundaries in buf.
        while let Some(pos) = buf.find('\n') {
            let line = buf[..pos].trim().to_string();
            buf = buf[pos + 1..].to_string();
            if !line.starts_with("data:") {
                continue;
            }
            let data = line[5..].trim().to_string();
            if data == "[DONE]" {
                let _ = app.emit("ai-done", ());
                return Ok(());
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(delta) = json
                    .pointer("/choices/0/delta/content")
                    .and_then(|v| v.as_str())
                {
                    if !delta.is_empty() {
                        let _ = app.emit("ai-chunk", delta.to_string());
                    }
                }
            }
        }
    }
    let _ = app.emit("ai-done", ());
    Ok(())
}