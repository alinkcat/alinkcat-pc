use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BilibiliLiveInfo {
    #[serde(rename = "roomId")]
    pub room_id: String,
    pub title: String,
    pub cover: String,
    #[serde(rename = "liveStatus")]
    pub live_status: u8,
    pub online: i64,
    #[serde(rename = "anchorName")]
    pub anchor_name: String,
    #[serde(rename = "roomUrl")]
    pub room_url: String,
}

/// Fetch Bilibili live room information (room details and streamer name).
pub async fn fetch_room_info(room_id: &str) -> Result<BilibiliLiveInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {}", e))?;

    // Basic room information
    let url = format!(
        "https://api.live.bilibili.com/room/v1/Room/get_info?id={}",
        room_id
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("network request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Bilibili API request failed, status: {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    if json["code"].as_i64().unwrap_or(-1) != 0 {
        return Err(format!(
            "Bilibili API returned error: {}",
            json["message"].as_str().unwrap_or("unknown")
        ));
    }

    let data = &json["data"];
    let uid = data["uid"].as_i64().unwrap_or(0);
    let room_id_val = data["room_id"].as_i64().unwrap_or(0).to_string();

    let mut info = BilibiliLiveInfo {
        room_id: room_id_val,
        title: data["title"].as_str().unwrap_or("").to_string(),
        cover: data["cover"].as_str().unwrap_or("").to_string(),
        live_status: data["live_status"].as_i64().unwrap_or(0) as u8,
        online: data["online"].as_i64().unwrap_or(0),
        anchor_name: String::new(),
        room_url: format!("https://live.bilibili.com/{}", room_id),
    };

    // Streamer name (failure does not affect the main data)
    if uid > 0 {
        let master_url = format!(
            "https://api.live.bilibili.com/live_user/v1/Master/info?uid={}",
            uid
        );
        if let Ok(resp2) = client.get(&master_url).send().await {
            if let Ok(json2) = resp2.json::<serde_json::Value>().await {
                if let Some(name) = json2["data"]["info"]["uname"].as_str() {
                    info.anchor_name = name.to_string();
                }
            }
        }
    }

    Ok(info)
}
