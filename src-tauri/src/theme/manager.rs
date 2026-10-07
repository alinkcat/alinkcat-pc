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

/// Tauri resource directory (where bundled themes are stored in production), injected at startup by lib.rs.
static RESOURCE_DIR: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();

/// Injects the resource directory during Tauri startup (the location of bundled themes).
pub fn set_resource_dir(dir: Option<PathBuf>) {
    let _ = RESOURCE_DIR.set(dir);
}

fn resource_themes_dir() -> Option<PathBuf> {
    RESOURCE_DIR
        .get()
        .and_then(|d| d.as_ref())
        .map(|d| d.join("themes"))
        .filter(|d| d.is_dir())
}

fn bundled_themes_dir() -> Option<PathBuf> {
    // 1) Prefer the bundled resource directory (production packages place src-tauri/themes there via bundle.resources).
    if let Some(themes) = resource_themes_dir() {
        return Some(themes);
    }
    // 2) Development fallback: walk up from the executable to find src-tauri/Cargo.toml and themes/.
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
                | "webview" | "weather" | "media-control" | "system-monitor" | "quick-action" | "launcher"
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

/// Built-in theme seeding is currently disabled (themes are not copied to the user directory at startup
/// to avoid creating empty shells without resources); retained for future re-enablement.
#[allow(dead_code)]
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

/// Seed built-in themes (currently disabled): copy bundled/source themes into the user directory.
/// The built-in theme mechanism is disabled, and lib.rs no longer calls this function; retained for future re-enablement.
#[allow(dead_code)]
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

    // Do not reseed built-in themes deleted by the user (prevents them from reappearing).
    let deleted: std::collections::HashSet<String> =
        config::load_config().deleted_builtin_themes.into_iter().collect();

    let mut copied = 0;
    for entry in entries.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let theme_id = entry.file_name().to_string_lossy().to_string();
        if deleted.contains(&theme_id) {
            continue;
        }
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

/// Scan local themes: **scan only the user directory** (`~/.ilinkcat/themes/`).
/// Built-in themes are copied there by init_themes on first launch; scanning no longer merges
/// the repository's bundled directory, avoiding phantom themes that appear in the list but lack a directory.
pub fn scan_themes() -> Result<Vec<ThemeSummary>, String> {
    let _ = ensure_user_dir();

    let user_dir = user_themes_dir();
    let mut results = scan_dir(&user_dir);
    results.sort_by(|a, b| a.name.cmp(&b.name));
    println!("[Theme] Scanned {} theme(s) from {}", results.len(), user_dir.display());
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

    // If the theme was previously marked as deleted (built‑in), remove that mark.
    let mut cfg = config::load_config();
    if cfg.deleted_builtin_themes.contains(&meta.id) {
        cfg.deleted_builtin_themes.retain(|x| x != &meta.id);
        config::save_config(&cfg).map_err(|e| format!("Failed to update config: {}", e))?;
    }
    let theme_dir = dir.join(&meta.id);
    if theme_dir.exists() {
        return Err(format!("Theme '{}' already exists", meta.id));
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

    // Whether this is a built-in theme (present in bundled resources/repository themes), determining
    // whether to record a deletion marker so later scans or init_themes cannot resurrect it.
    let is_builtin = bundled_themes_dir()
        .map(|b| b.join(id).join("theme.json").exists())
        .unwrap_or(false);

    // Load config to track deletions and active theme.
    let mut cfg = config::load_config();

    if theme_dir.is_dir() {
        // Delete user‑side copy.
        fs::remove_dir_all(&theme_dir)
            .map_err(|e| format!("Failed to delete theme '{}': {}", id, e))?;
    }

    // Built-in themes: record a deletion marker whether or not a user copy exists.
    // Scanning will hide them, and init_themes will not reseed them, preventing them from reappearing.
    if is_builtin && !cfg.deleted_builtin_themes.contains(&id.to_string()) {
        cfg.deleted_builtin_themes.push(id.to_string());
        config::save_config(&cfg).map_err(|e| format!("Failed to update config: {}", e))?;
    }

    // If the deleted theme was active, clear the active flag.
    if cfg.active_theme_id.as_deref() == Some(id) {
        cfg.active_theme_id = None;
        config::save_config(&cfg).map_err(|e| format!("Failed to update config: {}", e))?;
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

    // Extract embedded base64 data into standalone files so shared assets are stored only once across pages.
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

    // Remove orphaned assets: keep images referenced by theme.json and delete the rest.
    cleanup_orphaned_assets(&dir, meta)?;

    Ok(())
}

/// Scan every widget's extra fields, extract embedded base64 data into standalone files,
/// and replace data URLs with relative paths (such as assets/xxx.png) for reuse across pages.
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

    let val = match extra.get(key) {
        Some(v) if v.is_string() => v.as_str().unwrap().to_string(),
        _ => return Ok(()),
    };
    if !val.starts_with("data:") {
        return Ok(());
    }

    let body = val.split(',').nth(1).ok_or("Invalid data URL")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(body.trim())
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Name files with SHA-256 hashes, matching image_service for stable names and deduplication.
    let hash = crate::services::hash_service::sha256_bytes(&bytes);
    let ext = guess_ext_from_data_url(&val);
    let filename = format!("{}{}", hash, ext);
    let subdir = if ext == ".svg" { icons_dir } else { assets_dir };
    let rel_path = format!("{}/{}", if ext == ".svg" { "icons" } else { "assets" }, filename);

    if !seen.contains_key(&hash) {
        seen.insert(hash.clone(), filename.clone());
        fs::create_dir_all(subdir)
            .map_err(|e| format!("Failed to create dir: {}", e))?;
        let target = subdir.join(&filename);
        if !target.exists() {
            fs::write(&target, &bytes)
                .map_err(|e| format!("Failed to write asset: {}", e))?;
        }
    }

    // Replace data URL with relative path
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

/// Collect all asset paths referenced by theme.json.
fn collect_referenced_assets(meta: &ThemeMeta) -> Vec<String> {
    let mut refs = Vec::new();
    // Page background image
    for page in &meta.pages {
        if let Some(bg) = page.layout.extra.get("backgroundImage").and_then(|v| v.as_str()) {
            if !bg.starts_with("data:") && !bg.starts_with("http") {
                refs.push(bg.to_string());
            }
        }
        // Widget src / icon fields
        for w in &page.widgets {
            for key in ["src", "icon", "cardImage"] {
                if let Some(val) = w.extra.get(key).and_then(|v| v.as_str()) {
                    // Add relative paths (not data URLs or HTTP URLs) to the reference list.
                    if !val.starts_with("data:") && !val.starts_with("http") {
                        refs.push(val.to_string());
                    }
                }
            }
        }
    }
    refs
}

/// Delete files under assets/ and icons/ that are not referenced by theme.json.
fn cleanup_orphaned_assets(dir: &Path, meta: &ThemeMeta) -> Result<(), String> {
    let referenced = collect_referenced_assets(meta);

    for subdir in &["assets", "icons"] {
        let target = dir.join(subdir);
        if !target.is_dir() {
            continue;
        }
        let entries: Vec<_> = std::fs::read_dir(&target)
            .map_err(|e| format!("Failed to read {} directory: {}", subdir, e))?
            .filter_map(|e| e.ok())
            .collect();

        for entry in entries {
            if !entry.path().is_file() {
                continue;
            }
            // Relative paths such as "assets/xxx.png" or "icons/xxx.png".
            let rel = format!("{}/{}", subdir, entry.file_name().to_string_lossy());
            if !referenced.contains(&rel) {
                if let Err(e) = std::fs::remove_file(&entry.path()) {
                    eprintln!("[Theme] Failed to clean orphaned file {}: {}", rel, e);
                } else {
                    println!("[Theme] Cleaned up orphaned file: {}", rel);
                }
            }
        }
    }
    Ok(())
}

/// Generate the default placeholder cover (a hard-coded 1x1 blue PNG with no external crate).
pub fn write_default_cover(dir: &Path, _name: &str) -> Result<(), String> {
    use base64::Engine;
    // Embedded 1x1 blue PNG.
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
