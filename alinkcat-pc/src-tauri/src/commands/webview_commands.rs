use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::services::bilibili_service::{self, BilibiliLiveInfo};
use crate::services::rss_parser::{parse_rss, RssItem};
use crate::services::weather_service::{self, WeatherInfo};

const CACHE_TTL: Duration = Duration::from_secs(300);
const SHORT_CACHE_TTL: Duration = Duration::from_secs(60);

static CACHE: OnceLock<Mutex<HashMap<String, (Instant, serde_json::Value)>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, (Instant, serde_json::Value)>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cache_get(key: &str) -> Option<serde_json::Value> {
    cache_get_ttl(key, CACHE_TTL)
}

fn cache_get_ttl(key: &str, ttl: Duration) -> Option<serde_json::Value> {
    let map = cache().lock().unwrap();
    map.get(key)
        .filter(|(t, _)| t.elapsed() < ttl)
        .map(|(_, v)| v.clone())
}

fn cache_set(key: String, value: serde_json::Value) {
    cache().lock().unwrap().insert(key, (Instant::now(), value));
}

#[tauri::command]
pub async fn fetch_rss(url: String) -> Result<Vec<RssItem>, String> {
    if let Some(cached) = cache_get(&url) {
        return serde_json::from_value(cached).map_err(|e| format!("缓存数据反序列化失败: {}", e));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("请求失败，HTTP 状态码: {}", resp.status()));
    }

    let content = resp
        .text()
        .await
        .map_err(|e| format!("读取响应内容失败: {}", e))?;

    let items = parse_rss(&content)?;

    if let Ok(value) = serde_json::to_value(&items) {
        cache_set(url, value);
    }

    Ok(items)
}

#[tauri::command]
pub async fn fetch_json(url: String) -> Result<serde_json::Value, String> {
    if let Some(cached) = cache_get(&url) {
        return Ok(cached);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("请求失败，HTTP 状态码: {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON 解析失败: {}", e))?;

    cache_set(url, json.clone());

    Ok(json)
}

#[tauri::command]
pub async fn fetch_bilibili_room(room_id: String) -> Result<BilibiliLiveInfo, String> {
    let cache_key = format!("bili:{}", room_id);
    if let Some(cached) = cache_get_ttl(&cache_key, SHORT_CACHE_TTL) {
        return serde_json::from_value(cached)
            .map_err(|e| format!("缓存数据反序列化失败: {}", e));
    }

    let info = bilibili_service::fetch_room_info(&room_id).await?;

    if let Ok(value) = serde_json::to_value(&info) {
        cache_set(cache_key, value);
    }

    Ok(info)
}

#[tauri::command]
pub async fn fetch_weather(
    city: String,
    api_key: String,
    unit: String,
) -> Result<WeatherInfo, String> {
    let cache_key = format!("weather:{}:{}:{}", city, api_key, unit);
    if let Some(cached) = cache_get_ttl(&cache_key, SHORT_CACHE_TTL) {
        return serde_json::from_value(cached)
            .map_err(|e| format!("缓存数据反序列化失败: {}", e));
    }

    let info = weather_service::fetch_weather(&city, &api_key, &unit).await?;

    if let Ok(value) = serde_json::to_value(&info) {
        cache_set(cache_key, value);
    }

    Ok(info)
}
