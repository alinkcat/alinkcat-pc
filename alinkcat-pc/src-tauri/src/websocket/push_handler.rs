use serde_json::json;

pub fn push_start(
    req_id: u64,
    theme_id: &str,
    name: &str,
    version: &str,
    size: u64,
    total_chunks: u32,
    hash: &str,
) -> serde_json::Value {
    json!({
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "theme.push.start",
        "params": {
            "themeId": theme_id,
            "name": name,
            "version": version,
            "size": size,
            "totalChunks": total_chunks,
            "hash": hash
        }
    })
}

pub fn push_chunk(
    req_id: u64,
    theme_id: &str,
    chunk_index: u32,
    data: &str,
    is_last: bool,
) -> serde_json::Value {
    json!({
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "theme.push.chunk",
        "params": {
            "themeId": theme_id,
            "chunkIndex": chunk_index,
            "data": data,
            "isLast": is_last
        }
    })
}

pub fn push_complete(req_id: u64, theme_id: &str, status: &str) -> serde_json::Value {
    json!({
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "theme.push.complete",
        "params": {
            "themeId": theme_id,
            "status": status
        }
    })
}

pub fn push_cancel(req_id: u64, theme_id: &str, reason: &str) -> serde_json::Value {
    json!({
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "theme.push.cancel",
        "params": {
            "themeId": theme_id,
            "reason": reason
        }
    })
}

/// pull the error message out of a phone response, if any
pub fn extract_error(resp: &serde_json::Value) -> Option<String> {
    resp.get("error").and_then(|e| e.get("message").and_then(|m| m.as_str()).map(String::from))
}
