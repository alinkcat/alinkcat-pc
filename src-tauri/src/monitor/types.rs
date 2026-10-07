use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PerfSnapshot {
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memory: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkSpeed>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub battery: Option<BatteryInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSpeed {
    pub upload: f64,
    pub download: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub level: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub charging: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorSubscribeParams {
    /// defaults to an empty list (phone sends empty params on unsubscribe)
    #[serde(default)]
    pub sources: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// phone unsubscribes with empty params {}, must not get -32602 back
    #[test]
    fn unsubscribe_with_empty_params_is_accepted() {
        let params: MonitorSubscribeParams = serde_json::from_str("{}").expect("empty params");
        assert!(params.sources.is_empty());

        let params: MonitorSubscribeParams =
            serde_json::from_str(r#"{"sources":["cpu"]}"#).expect("sources param");
        assert_eq!(params.sources, vec!["cpu".to_string()]);
    }
}
