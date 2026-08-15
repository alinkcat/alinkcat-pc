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
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            active_theme_id: None,
            command_whitelist: Vec::new(),
        }
    }
}
