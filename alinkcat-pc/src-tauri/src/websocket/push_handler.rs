use serde_json::json;

/// 生成 theme.push.start 消息
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

/// 生成 theme.push.chunk 消息（data 为 base64 字符串片段）
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

/// 生成 theme.push.complete 消息
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

/// 生成 theme.push.cancel 消息
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

/// 从手机端响应中提取错误信息（若有）。
pub fn extract_error(resp: &serde_json::Value) -> Option<String> {
    resp.get("error").and_then(|e| e.get("message").and_then(|m| m.as_str()).map(String::from))
}
