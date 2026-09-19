use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssItem {
    pub title: String,
    pub link: String,
    #[serde(rename = "pubDate")]
    pub pub_date: String,
    pub description: Option<String>,
    pub author: Option<String>,
}

/// Parse RSS 2.0 / Atom feed text and return a normalized article list.
pub fn parse_rss(content: &str) -> Result<Vec<RssItem>, String> {
    let channel = rss::Channel::read_from(content.as_bytes())
        .map_err(|e| format!("RSS parsing failed: {}", e))?;

    let mut items = Vec::new();
    for item in channel.items() {
        items.push(RssItem {
            title: item.title().unwrap_or("").to_string(),
            link: item.link().unwrap_or("").to_string(),
            pub_date: item.pub_date().unwrap_or("").to_string(),
            description: item.description().map(|s| s.to_string()),
            author: item.author().map(|s| s.to_string()),
        });
    }

    if items.is_empty() {
        return Err("no available articles in the feed".to_string());
    }

    Ok(items)
}
