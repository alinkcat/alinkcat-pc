use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::services::hash_service;
use crate::theme::manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadRecord {
    pub id: String,
    pub theme_id: String,
    pub theme_name: String,
    pub version: String,
    pub submitted_at: String,
    pub status: String,
    pub hash: String,
    pub size: u64,
    pub category: String,
    pub tags: Vec<String>,
    pub description: String,
    pub screenshots: Vec<String>,
    pub review_comment: Option<String>,
}

fn records_path() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".ilinkcat")
        .join("upload_history.json")
}

fn load_records() -> Vec<UploadRecord> {
    let p = records_path();
    if !p.exists() {
        return Vec::new();
    }
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_records(records: &[UploadRecord]) -> Result<(), String> {
    let p = records_path();
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(records)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&p, json).map_err(|e| format!("写入记录失败: {}", e))
}

#[tauri::command]
pub fn get_upload_records() -> Result<Vec<UploadRecord>, String> {
    Ok(load_records())
}

#[tauri::command]
pub fn get_upload_status(record_id: String) -> Result<UploadRecord, String> {
    load_records()
        .into_iter()
        .find(|r| r.id == record_id)
        .ok_or_else(|| "上传记录不存在".to_string())
}

#[tauri::command]
pub fn calculate_file_hash(file_path: String) -> Result<String, String> {
    hash_service::sha256_file(&PathBuf::from(file_path))
}

#[tauri::command]
pub fn submit_theme_for_review(
    theme_id: String,
    category: String,
    tags: Vec<String>,
    description: String,
    screenshots: Vec<String>,
) -> Result<UploadRecord, String> {
    let theme_dir = manager::get_theme_dir(&theme_id)?;
    let meta = manager::read_theme_meta_pub(&theme_dir)?;

    let theme_json = theme_dir.join("theme.json");
    let hash = hash_service::sha256_file(&theme_json)?;
    let size = hash_service::dir_size(&theme_dir);

    let mut records = load_records();
    if records.iter().any(|r| r.hash == hash[..16].to_string()) {
        return Err("该主题包已提交过审核，请勿重复上传".to_string());
    }

    let record = UploadRecord {
        id: format!("UP{}", chrono::Utc::now().timestamp_millis()),
        theme_id: theme_id.clone(),
        theme_name: meta.name,
        version: meta.version,
        submitted_at: chrono::Utc::now().to_rfc3339(),
        status: "pending".to_string(),
        hash: hash[..16].to_string(),
        size,
        category,
        tags,
        description,
        screenshots,
        review_comment: None,
    };

    records.push(record.clone());
    save_records(&records)?;

    Ok(record)
}

#[tauri::command]
pub fn update_upload_status(
    record_id: String,
    status: String,
    comment: Option<String>,
) -> Result<UploadRecord, String> {
    let mut records = load_records();
    let rec = records
        .iter_mut()
        .find(|r| r.id == record_id)
        .ok_or_else(|| "上传记录不存在".to_string())?;
    rec.status = status.clone();
    rec.review_comment = comment;
    let cloned = rec.clone();
    save_records(&records)?;
    Ok(cloned)
}

#[tauri::command]
pub fn delete_upload_record(record_id: String) -> Result<(), String> {
    let mut records = load_records();
    records.retain(|r| r.id != record_id);
    save_records(&records)
}
