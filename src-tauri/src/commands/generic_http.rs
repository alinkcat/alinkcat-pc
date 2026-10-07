use tauri::command;
use serde_json::Value;
use std::collections::HashMap;

#[command]
pub async fn generic_http(
    url: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let method = method.to_uppercase();
    let mut request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        other => return Err(format!("unsupported HTTP method: {}", other)),
    };

    if let Some(h) = headers {
        for (k, v) in h {
            request = request.header(&k, &v);
        }
    }

    if let Some(b) = body {
        // Some services return 415 immediately without a Content-Type header.
        if method == "POST" {
            request = request.header("Content-Type", "application/json");
        }
        request = request.body(b);
    }

    let resp = request.send().await.map_err(|e| e.to_string())?;
    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}
