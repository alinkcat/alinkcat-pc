use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use super::config;
use super::types::*;

fn user_themes_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".ilinkcat")
        .join("themes")
}

pub fn user_theme_root() -> PathBuf {
    user_themes_dir()
}

pub fn find_theme_dir_pub(id: &str) -> Option<PathBuf> {
    find_theme_dir(id)
}

fn bundled_themes_dir() -> Option<PathBuf> {
    // Walk up from the executable looking for src-tauri/Cargo.toml + themes/
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(|p| p.to_path_buf());
        while let Some(d) = dir {
            // Found src-tauri root (has Cargo.toml and themes/)
            if d.join("Cargo.toml").exists() {
                let themes = d.join("themes");
                if themes.is_dir() {
                    return Some(themes);
                }
            }
            dir = d.parent().map(|p| p.to_path_buf());
        }
    }
    None
}

fn ensure_user_dir() -> Result<PathBuf, String> {
    let dir = user_themes_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create themes directory: {}", e))?;
    Ok(dir)
}

fn read_theme_meta(theme_dir: &Path) -> Result<ThemeMeta, String> {
    let json_path = theme_dir.join("theme.json");
    let content = fs::read_to_string(&json_path)
        .map_err(|e| format!("Failed to read {}: {}", json_path.display(), e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Invalid theme.json in {}: {}", theme_dir.display(), e))
}

pub fn read_theme_meta_pub(theme_dir: &Path) -> Result<ThemeMeta, String> {
    read_theme_meta(theme_dir)
}

fn validate_theme(meta: &ThemeMeta) -> Result<(), String> {
    if meta.id.is_empty() {
        return Err("Theme id must not be empty".into());
    }
    if meta.id.contains('/') || meta.id.contains('\\') || meta.id.contains("..") {
        return Err(format!("Invalid theme id: {}", meta.id));
    }
    if meta.name.is_empty() {
        return Err("Theme name must not be empty".into());
    }
    if meta.pages.is_empty() {
        return Err("Theme must contain at least one page".into());
    }
    for page in &meta.pages {
        if page.id.is_empty() {
            return Err(format!("Page id must not be empty (in page '{}')", page.label));
        }
        match page.layout.layout_type.as_str() {
            "grid" | "list" | "free" => {}
            other => {
                return Err(format!(
                    "Invalid layout type '{}' in page '{}'",
                    other, page.id
                ));
            }
        }
        for widget in &page.widgets {
            match widget.widget_type.as_str() {
                "button" | "gauge" | "battery" | "card" | "snippet-list" | "image" | "icon" | "text" | "shape"
                | "webview" | "media-control" | "system-monitor" | "quick-action" | "launcher"
                | "clock" | "date" | "calendar" => {}
                other => {
                    return Err(format!(
                        "Invalid widget type '{}' in widget '{}' (page '{}')",
                        other, widget.id, page.id
                    ));
                }
            }
        }
    }
    Ok(())
}

fn scan_dir(dir: &Path) -> Vec<ThemeSummary> {
    let mut results = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return results,
    };
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        if !entry.path().join("theme.json").exists() {
            continue;
        }
        match read_theme_meta(&entry.path()) {
            Ok(meta) => {
                let cover_url = meta.pages.first().and_then(|p| {
                    p.layout
                        .extra
                        .get("backgroundImage")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                });
                results.push(ThemeSummary {
                    id: meta.id,
                    name: meta.name,
                    version: meta.version,
                    author: meta.author,
                    description: meta.description,
                    preview: meta.preview,
                    page_count: meta.pages.len(),
                    has_cover: entry.path().join("cover.png").exists(),
                    cover_url,
                    source: meta.source,
                    market_id: meta.market_id,
                    path: entry.path().to_string_lossy().to_string(),
                });
            }
            Err(e) => {
                eprintln!("[Theme] Skipping {}: {}", entry.path().display(), e);
            }
        }
    }
    results
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn find_theme_dir(id: &str) -> Option<PathBuf> {
    // User dir takes priority (allows overriding bundled themes)
    let user = user_themes_dir().join(id);
    if user.is_dir() && user.join("theme.json").exists() {
        return Some(user);
    }
    // Fall back to bundled
    if let Some(bundled) = bundled_themes_dir() {
        let b = bundled.join(id);
        if b.is_dir() && b.join("theme.json").exists() {
            return Some(b);
        }
    }
    None
}

// ─── Public API ─────────────────────────────────────────────

pub fn init_themes() {
    let bundled = match bundled_themes_dir() {
        Some(b) => b,
        None => {
            println!("[Theme] No bundled themes directory found");
            return;
        }
    };

    println!("[Theme] Bundled themes dir: {}", bundled.display());

    let user_dir = user_themes_dir();
    if let Err(e) = fs::create_dir_all(&user_dir) {
        eprintln!("[Theme] Failed to create user themes dir: {}", e);
        return;
    }

    let entries = match fs::read_dir(&bundled) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut copied = 0;
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let theme_id = entry.file_name().to_string_lossy().to_string();
        let dst = user_dir.join(&theme_id);
        if dst.exists() {
            continue;
        }
        if let Err(e) = copy_dir_recursive(&entry.path(), &dst) {
            eprintln!("[Theme] Failed to copy bundled theme '{}': {}", theme_id, e);
        } else {
            println!("[Theme] Copied bundled theme '{}' to user dir", theme_id);
            copied += 1;
        }
    }

    if copied > 0 {
        println!("[Theme] Initialized {} bundled theme(s)", copied);
    }
}

pub fn scan_themes() -> Result<Vec<ThemeSummary>, String> {
    let _ = ensure_user_dir();

    let mut map: HashMap<String, ThemeSummary> = HashMap::new();

    // 1) Scan bundled themes first (lower priority)
    if let Some(bundled) = bundled_themes_dir() {
        let bundled_themes = scan_dir(&bundled);
        println!("[Theme] Scanned bundled: {} theme(s) from {}", bundled_themes.len(), bundled.display());
        for t in bundled_themes {
            map.insert(t.id.clone(), t);
        }
    } else {
        println!("[Theme] No bundled themes directory found");
    }

    // 2) Scan user themes (higher priority, overrides bundled)
    let user_dir = user_themes_dir();
    let user_themes = scan_dir(&user_dir);
    println!("[Theme] Scanned user: {} theme(s) from {}", user_themes.len(), user_dir.display());
    for t in user_themes {
        map.insert(t.id.clone(), t);
    }

    let mut results: Vec<ThemeSummary> = map.into_values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    println!("[Theme] Total: {} theme(s)", results.len());
    Ok(results)
}

pub fn load_theme(id: &str) -> Result<ThemeMeta, String> {
    let dir = find_theme_dir(id).ok_or_else(|| format!("Theme '{}' not found", id))?;
    read_theme_meta(&dir)
}

pub fn activate_theme(id: &str) -> Result<(), String> {
    find_theme_dir(id).ok_or_else(|| format!("Theme '{}' not found", id))?;
    let mut cfg = config::load_config();
    cfg.active_theme_id = Some(id.to_string());
    config::save_config(&cfg)
}

pub fn get_active_theme() -> Option<String> {
    config::load_config().active_theme_id
}

pub fn import_theme(zip_path: &Path) -> Result<ThemeMeta, String> {
    let dir = ensure_user_dir()?;

    let file =
        fs::File::open(zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut prefix: Option<String> = None;
    for i in 0..archive.len() {
        let f = archive
            .by_index(i)
            .map_err(|e| format!("Zip index error: {}", e))?;
        let name = f.name().replace('\\', "/");
        if name.ends_with("theme.json") {
            let p = &name[..name.len() - "theme.json".len()];
            prefix = Some(p.to_string());
            break;
        }
    }

    let prefix = prefix.ok_or("theme.json not found in archive")?;

    let theme_json_name = format!("{}theme.json", prefix);
    let meta: ThemeMeta = {
        let mut f = archive
            .by_name(&theme_json_name)
            .map_err(|e| format!("Failed to read {} from archive: {}", theme_json_name, e))?;
        let mut buf = String::new();
        io::Read::read_to_string(&mut f, &mut buf)
            .map_err(|e| format!("Failed to read theme.json content: {}", e))?;
        serde_json::from_str(&buf).map_err(|e| format!("Invalid theme.json in archive: {}", e))?
    };

    validate_theme(&meta)?;

    let theme_dir = dir.join(&meta.id);
    if theme_dir.exists() {
        fs::remove_dir_all(&theme_dir)
            .map_err(|e| format!("Failed to remove existing theme: {}", e))?;
    }

    for i in 0..archive.len() {
        let mut f = archive
            .by_index(i)
            .map_err(|e| format!("Zip index error: {}", e))?;
        let raw_name = f.name().replace('\\', "/");

        let relative = match raw_name.strip_prefix(&prefix) {
            Some(r) => r,
            None => continue,
        };
        if relative.is_empty() {
            continue;
        }
        if relative.contains("..") {
            continue;
        }

        let outpath = theme_dir.join(relative);
        if f.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create dir {}: {}", outpath.display(), e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create dir {}: {}", parent.display(), e))?;
            }
            let mut out = fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create {}: {}", outpath.display(), e))?;
            io::copy(&mut f, &mut out)
                .map_err(|e| format!("Failed to extract {}: {}", outpath.display(), e))?;
        }
    }

    read_theme_meta(&theme_dir)
}

pub fn delete_theme(id: &str) -> Result<(), String> {
    let user_dir = user_themes_dir();
    let theme_dir = user_dir.join(id);

    if !theme_dir.is_dir() {
        if let Some(bundled) = bundled_themes_dir() {
            if bundled.join(id).is_dir() {
                return Err(format!(
                    "Theme '{}' is a built-in theme and cannot be deleted",
                    id
                ));
            }
        }
        return Err(format!("Theme '{}' not found", id));
    }

    fs::remove_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to delete theme '{}': {}", id, e))?;

    let mut cfg = config::load_config();
    if cfg.active_theme_id.as_deref() == Some(id) {
        cfg.active_theme_id = None;
        config::save_config(&cfg)?;
    }

    Ok(())
}

pub fn save_theme(
    meta: &mut ThemeMeta,
    cover_path: Option<&Path>,
    cover_data: Option<&str>,
) -> Result<(), String> {
    validate_theme(meta)?;
    let dir = ensure_user_dir()?.join(&meta.id);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create theme dir: {}", e))?;

    // 提取 base64 嵌入数据为独立文件，实现多页面复用时只存一份
    extract_embedded_assets(meta, &dir)?;

    let json = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("Failed to serialize theme: {}", e))?;
    fs::write(dir.join("theme.json"), json)
        .map_err(|e| format!("Failed to write theme.json: {}", e))?;

    if let Some(src) = cover_path {
        fs::copy(src, dir.join("cover.png"))
            .map_err(|e| format!("Failed to copy cover: {}", e))?;
    } else if let Some(data) = cover_data {
        write_cover_data(&dir, data)?;
    }

    println!("[Theme] Saved theme '{}' to {}", meta.id, dir.display());

    // 清理 orphaned 资源：theme.json 中引用的图片保留，其余删除
    cleanup_orphaned_assets(&dir, meta)?;

    Ok(())
}

/// 扫描所有 widget 的 extra 字段，将 base64 嵌入数据提取为独立文件，
/// 并将 data URL 替换为相对路径（如 assets/xxx.png），实现多页面数据复用。
fn extract_embedded_assets(meta: &mut ThemeMeta, dir: &Path) -> Result<(), String> {
    let assets_dir = dir.join("assets");
    let icons_dir = dir.join("icons");

    // hash -> filename
    let mut seen: HashMap<String, String> = HashMap::new();

    for page in &mut meta.pages {
        extract_and_replace_in_map(
            &mut page.layout.extra, "backgroundImage",
            &mut seen, &assets_dir, &icons_dir,
        )?;
        for w in &mut page.widgets {
            for key in &["src", "icon", "backgroundImage", "cardImage"] {
                extract_and_replace_in_map(
                    &mut w.extra, key,
                    &mut seen, &assets_dir, &icons_dir,
                )?;
            }
        }
    }
    Ok(())
}

fn extract_and_replace_in_map(
    extra: &mut HashMap<String, serde_json::Value>,
    key: &str,
    seen: &mut HashMap<String, String>,
    assets_dir: &Path,
    icons_dir: &Path,
) -> Result<(), String> {
    use base64::Engine;
    use std::hash::{Hash, Hasher};

    let val = match extra.get(key) {
        Some(v) if v.is_string() => v.as_str().unwrap().to_string(),
        _ => return Ok(()),
    };
    if !val.starts_with("data:") {
        return Ok(());
    }

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    val.hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());

    let ext = guess_ext_from_data_url(&val);
    let filename = format!("{}{}", hash, ext);
    let subdir = if ext == ".svg" { icons_dir } else { assets_dir };
    let rel_path = format!("{}/{}", if ext == ".svg" { "icons" } else { "assets" }, filename);

    if !seen.contains_key(&hash) {
        seen.insert(hash.clone(), filename.clone());
        let body = val.split(',').nth(1).ok_or("Invalid data URL")?;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(body.trim())
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        fs::create_dir_all(subdir)
            .map_err(|e| format!("Failed to create dir: {}", e))?;
        let target = subdir.join(&filename);
        if !target.exists() {
            fs::write(&target, &bytes)
                .map_err(|e| format!("Failed to write asset: {}", e))?;
        }
    }

    // Replace data URL with relative path (use a clone to avoid borrow issues)
    extra.insert(key.to_string(), serde_json::Value::String(rel_path));
    Ok(())
}

fn guess_ext_from_data_url(data_url: &str) -> String {
    if let Some(semi) = data_url.find(';') {
        let mime = &data_url[5..semi];
        match mime {
            "image/png" => ".png",
            "image/jpeg" | "image/jpg" => ".jpg",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            "image/svg+xml" => ".svg",
            "image/x-icon" | "image/vnd.microsoft.icon" => ".ico",
            "image/bmp" => ".bmp",
            _ => ".bin",
        }.to_string()
    } else {
        ".bin".to_string()
    }
}

/// 解析 theme.json 中所有引用的资源路径
fn collect_referenced_assets(meta: &ThemeMeta) -> Vec<String> {
    let mut refs = Vec::new();
    // 页面背景图
    for page in &meta.pages {
        if let Some(bg) = page.layout.extra.get("backgroundImage").and_then(|v| v.as_str()) {
            if !bg.starts_with("data:") && !bg.starts_with("http") {
                refs.push(bg.to_string());
            }
        }
        // 控件中的 src / icon
        for w in &page.widgets {
            for key in ["src", "icon", "cardImage"] {
                if let Some(val) = w.extra.get(key).and_then(|v| v.as_str()) {
                    // 如果存的是相对路径（非 data URL 和非 http），加入引用列表
                    if !val.starts_with("data:") && !val.starts_with("http") {
                        refs.push(val.to_string());
                    }
                }
            }
        }
    }
    refs
}

/// 删除 assets/ 和 icons/ 下未被 theme.json 引用的文件
fn cleanup_orphaned_assets(dir: &Path, meta: &ThemeMeta) -> Result<(), String> {
    let referenced = collect_referenced_assets(meta);

    for subdir in &["assets", "icons"] {
        let target = dir.join(subdir);
        if !target.is_dir() {
            continue;
        }
        let entries: Vec<_> = std::fs::read_dir(&target)
            .map_err(|e| format!("读取 {} 目录失败: {}", subdir, e))?
            .filter_map(|e| e.ok())
            .collect();

        for entry in entries {
            if !entry.path().is_file() {
                continue;
            }
            // 相对路径如 "assets/xxx.png" 或 "icons/xxx.png"
            let rel = format!("{}/{}", subdir, entry.file_name().to_string_lossy());
            if !referenced.contains(&rel) {
                if let Err(e) = std::fs::remove_file(&entry.path()) {
                    eprintln!("[Theme] 清理 orphaned 文件失败 {}: {}", rel, e);
                } else {
                    println!("[Theme] 已清理 orphaned 文件: {}", rel);
                }
            }
        }
    }
    Ok(())
}

/// 生成默认占位封面（硬编码 1x1 蓝色 PNG，不依赖外部 crate）
pub fn write_default_cover(dir: &Path, _name: &str) -> Result<(), String> {
    use base64::Engine;
    // 预置的 1x1 蓝色 PNG
    const COVER_B64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPwz/sOAALEAbV2m9TiAAAAAElFTkSuQmCC";
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(COVER_B64)
        .map_err(|e| format!("Cover base64 decode error: {}", e))?;
    fs::write(dir.join("cover.png"), bytes)
        .map_err(|e| format!("Failed to write default cover: {}", e))?;
    Ok(())
}

fn write_cover_data(dir: &Path, data_url: &str) -> Result<(), String> {
    use base64::Engine;

    let body = data_url
        .split(',')
        .nth(1)
        .ok_or("Invalid cover data URL")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(body.trim())
        .map_err(|e| format!("Cover base64 decode error: {}", e))?;
    fs::write(dir.join("cover.png"), bytes)
        .map_err(|e| format!("Failed to write cover.png: {}", e))?;
    Ok(())
}

pub fn get_theme_dir(id: &str) -> Result<PathBuf, String> {
    find_theme_dir(id).ok_or_else(|| format!("Theme '{}' not found", id))
}

pub fn export_theme(id: &str, output: &Path) -> Result<(), String> {
    let src = find_theme_dir(id).ok_or_else(|| format!("Theme '{}' not found", id))?;

    let file =
        fs::File::create(output).map_err(|e| format!("Failed to create {}: {}", output.display(), e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    fn add_dir(
        zip: &mut zip::ZipWriter<fs::File>,
        dir: &Path,
        base: &Path,
        options: zip::write::SimpleFileOptions,
    ) -> Result<(), String> {
        for entry in
            fs::read_dir(dir).map_err(|e| format!("ReadDir error: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
            let path = entry.path();
            let name = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            if path.is_dir() {
                zip.add_directory(format!("{}/", name), options)
                    .map_err(|e| format!("Zip dir error: {}", e))?;
                add_dir(zip, &path, base, options)?;
            } else {
                zip.start_file(&name, options)
                    .map_err(|e| format!("Zip file error: {}", e))?;
                let mut f = fs::File::open(&path)
                    .map_err(|e| format!("Open error: {}", e))?;
                io::copy(&mut f, zip)
                    .map_err(|e| format!("Copy error: {}", e))?;
            }
        }
        Ok(())
    }

    add_dir(&mut zip, &src, &src, options)?;
    zip.finish().map_err(|e| format!("Zip finish error: {}", e))?;
    println!("[Theme] Exported '{}' to {}", id, output.display());
    Ok(())
}
