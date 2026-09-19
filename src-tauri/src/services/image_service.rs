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

/// Save a base64 data URL image to the theme package's assets/ directory and return its relative path.
pub fn save_image_data(data_url: &str, theme_id: &str, _widget_id: &str) -> Result<String, String> {
    save_to_dir(data_url, theme_id, "assets")
}

/// Save a base64 data URL icon to the theme package's icons/ directory and return its relative path.
pub fn save_icon_data(data_url: &str, theme_id: &str, _widget_id: &str) -> Result<String, String> {
    save_to_dir(data_url, theme_id, "icons")
}

fn save_to_dir(data_url: &str, theme_id: &str, subdir: &str) -> Result<String, String> {
    if !data_url.starts_with("data:") {
        return Err("not valid image data".to_string());
    }
    let meta = data_url.split(',').next().unwrap_or("");
    let body = data_url.split(',').nth(1).ok_or("invalid image data")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(body.trim())
        .map_err(|e| format!("failed to decode image: {}", e))?;

    // Name files by content SHA-256 hash so identical images share a name.
    let hash = crate::services::hash_service::sha256_bytes(&bytes);
    let ext = ext_from_mime(meta);
    let dir = manager::user_theme_root().join(theme_id).join(subdir);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create {} directory: {}", subdir, e))?;

    let filename = format!("{}.{}", hash, ext);
    let rel = format!("{}/{}", subdir, filename);
    let target = dir.join(&filename);
    // Skip writing if the file already exists.
    if !target.exists() {
        std::fs::write(&target, &bytes)
            .map_err(|e| format!("failed to write file: {}", e))?;
    }

    Ok(rel)
}

/// Read an image from the theme package and return a data URL.
pub fn get_image_data(theme_id: &str, rel_path: &str) -> Result<String, String> {
    if !sanitize_rel(rel_path) {
        return Err("invalid image path".to_string());
    }
    let dir = manager::find_theme_dir_pub(theme_id)
        .ok_or_else(|| format!("theme '{}' not found", theme_id))?;
    let path = dir.join(rel_path);
    let bytes = std::fs::read(&path).map_err(|e| format!("failed to read image: {}", e))?;
    let ext = Path::new(rel_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = mime_from_ext(&ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Delete an image from the theme package.
pub fn delete_image(theme_id: &str, rel_path: &str) -> Result<(), String> {
    if !sanitize_rel(rel_path) {
        return Err("invalid image path".to_string());
    }
    let dir = manager::user_theme_root().join(theme_id);
    let path = dir.join(rel_path);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("failed to delete image: {}", e))?;
    }
    Ok(())
}
