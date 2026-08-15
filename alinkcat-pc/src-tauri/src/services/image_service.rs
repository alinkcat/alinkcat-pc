use std::path::Path;

use base64::Engine;

use crate::theme::manager;

fn ext_from_mime(meta: &str) -> &'static str {
    if meta.contains("image/png") {
        "png"
    } else if meta.contains("image/jpeg") || meta.contains("image/jpg") {
        "jpg"
    } else if meta.contains("image/webp") {
        "webp"
    } else if meta.contains("image/svg") {
        "svg"
    } else if meta.contains("image/gif") {
        "gif"
    } else {
        "png"
    }
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    }
}

fn sanitize_rel(rel: &str) -> bool {
    !rel.contains("..") && !rel.starts_with('/') && !rel.starts_with('\\')
}

/// 将 base64 data URL 图片保存到主题包 assets/ 目录，返回相对路径。
pub fn save_image_data(data_url: &str, theme_id: &str, widget_id: &str) -> Result<String, String> {
    save_to_dir(data_url, theme_id, widget_id, "assets")
}

/// 将 base64 data URL 图标保存到主题包 icons/ 目录，返回相对路径。
pub fn save_icon_data(data_url: &str, theme_id: &str, widget_id: &str) -> Result<String, String> {
    save_to_dir(data_url, theme_id, widget_id, "icons")
}

fn save_to_dir(data_url: &str, theme_id: &str, widget_id: &str, subdir: &str) -> Result<String, String> {
    if !data_url.starts_with("data:") {
        return Err("不是有效的图片数据".to_string());
    }
    let meta = data_url.split(',').next().unwrap_or("");
    let body = data_url.split(',').nth(1).ok_or("无效的图片数据")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(body.trim())
        .map_err(|e| format!("图片解码失败: {}", e))?;

    let ext = ext_from_mime(meta);
    let dir = manager::user_theme_root().join(theme_id).join(subdir);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("创建 {} 目录失败: {}", subdir, e))?;

    let ts = chrono::Utc::now().timestamp_millis();
    let safe_widget: String = widget_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .take(20)
        .collect();
    let filename = format!("{}_{}.{}", safe_widget, ts, ext);
    let rel = format!("{}/{}", subdir, filename);
    std::fs::write(dir.join(&filename), &bytes)
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(rel)
}

/// 读取主题包内图片，返回 data URL。
pub fn get_image_data(theme_id: &str, rel_path: &str) -> Result<String, String> {
    if !sanitize_rel(rel_path) {
        return Err("无效的图片路径".to_string());
    }
    let dir = manager::find_theme_dir_pub(theme_id)
        .ok_or_else(|| format!("主题包 '{}' 不存在", theme_id))?;
    let path = dir.join(rel_path);
    let bytes = std::fs::read(&path).map_err(|e| format!("读取图片失败: {}", e))?;
    let ext = Path::new(rel_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = mime_from_ext(&ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// 删除主题包内图片。
pub fn delete_image(theme_id: &str, rel_path: &str) -> Result<(), String> {
    if !sanitize_rel(rel_path) {
        return Err("无效的图片路径".to_string());
    }
    let dir = manager::user_theme_root().join(theme_id);
    let path = dir.join(rel_path);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("删除图片失败: {}", e))?;
    }
    Ok(())
}
