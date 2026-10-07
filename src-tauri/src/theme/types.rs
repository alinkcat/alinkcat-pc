use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub preview: Option<String>,
    pub pages: Vec<PageDefinition>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub market_id: Option<String>,
    #[serde(default)]
    pub downloaded_at: Option<String>,
    /// portrait / landscape; kept on save, the phone uses it for orientation
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageDefinition {
    pub id: String,
    pub label: String,
    pub layout: LayoutConfig,
    #[serde(default)]
    pub widgets: Vec<WidgetDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    #[serde(rename = "type")]
    pub layout_type: String,
    #[serde(default)]
    pub columns: Option<u32>,
    #[serde(default)]
    pub rows: Option<u32>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetDefinition {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub label: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub preview: Option<String>,
    pub page_count: usize,
    pub has_cover: bool,
    #[serde(default)]
    pub cover_url: Option<String>,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub market_id: Option<String>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub active_theme_id: Option<String>,
    #[serde(default)]
    pub command_whitelist: Vec<String>,
    #[serde(default)]
    pub deleted_builtin_themes: Vec<String>,
    /// extra theme scan root configured by the user in Settings (highest priority)
    #[serde(default)]
    pub custom_themes_dir: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_theme_id: None,
            command_whitelist: Vec::new(),
            deleted_builtin_themes: Vec::new(),
            custom_themes_dir: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const META_JSON: &str = r#"{
        "id": "t1",
        "name": "Test",
        "version": "1.0.0",
        "author": "a",
        "pages": [],
        "source": "local",
        "orientation": "portrait"
    }"#;

    /// orientation must not get dropped on save
    #[test]
    fn orientation_survives_deserialize_serialize() {
        let meta: ThemeMeta = serde_json::from_str(META_JSON).expect("parse meta");
        assert_eq!(meta.orientation.as_deref(), Some("portrait"));

        let out = serde_json::to_value(&meta).expect("serialize meta");
        assert_eq!(out.get("orientation").and_then(|v| v.as_str()), Some("portrait"));
    }

    /// packs without orientation must not serialize a null
    #[test]
    fn missing_orientation_is_absent_not_null() {
        let json = r#"{
            "id": "t1",
            "name": "Test",
            "version": "1.0.0",
            "author": "a",
            "pages": [],
            "source": "local"
        }"#;
        let meta: ThemeMeta = serde_json::from_str(json).expect("parse meta without orientation");
        assert!(meta.orientation.is_none());

        let out = serde_json::to_value(&meta).expect("serialize meta");
        assert!(out.get("orientation").is_none());
    }
}
