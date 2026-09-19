use std::path::PathBuf;

use super::types::AppConfig;

const CONFIG_FILE: &str = "config.json";

pub fn config_path() -> PathBuf {
    let base = dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".ilinkcat");
    base.join(CONFIG_FILE)
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    if !path.exists() {
        return AppConfig::default();
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return AppConfig::default(),
    };
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}
