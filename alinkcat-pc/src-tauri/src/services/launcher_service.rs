use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherItem {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub icon_cache_path: Option<String>,
}

const CONFIG_FILE: &str = "launchers.json";

fn config_path() -> std::path::PathBuf {
    dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".ilinkcat")
        .join(CONFIG_FILE)
}

fn load() -> Vec<LauncherItem> {
    let p = config_path();
    if !p.exists() { return vec![]; }
    std::fs::read_to_string(&p).ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(items: &[LauncherItem]) -> Result<(), String> {
    let p = config_path();
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, serde_json::to_string_pretty(items).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

pub fn list() -> Vec<LauncherItem> {
    load()
}

pub fn add(name: String, path: String) -> Result<LauncherItem, String> {
    let mut items = load();
    let id = format!("lnch-{}", chrono::Utc::now().timestamp_millis());
    let item = LauncherItem { id, name, path, icon_cache_path: None };
    items.push(item.clone());
    save(&items)?;
    Ok(item)
}

pub fn remove(id: &str) -> Result<(), String> {
    let mut items = load();
    items.retain(|i| i.id != id);
    save(&items)
}

pub fn open(id: &str) -> Result<(), String> {
    let items = load();
    let item = items.iter().find(|i| i.id == id).ok_or_else(|| "启动项不存在".to_string())?;
    launch(&item.path)
}

#[cfg(target_os = "windows")]
fn launch(path: &str) -> Result<(), String> {
    std::process::Command::new(path)
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch(path: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-a")
        .arg(path)
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch(path: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;
    Ok(())
}