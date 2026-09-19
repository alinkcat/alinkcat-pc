use chrono::NaiveDate;
use serde_json::json;

use crate::services::calendar_service::{self, LunarInfo};

/// Get lunar-calendar information for the specified Gregorian date.
/// The date format is "YYYY-MM-DD"; when omitted, today's lunar date is returned.
#[tauri::command]
pub fn get_lunar_info(date: Option<String>) -> Result<LunarInfo, String> {
    let d = match date {
        Some(s) => NaiveDate::parse_from_str(&s, "%Y-%m-%d")
            .map_err(|e| format!("invalid date format (expected YYYY-MM-DD): {}", e))?,
        None => chrono::Local::now().date_naive(),
    };
    calendar_service::get_lunar_info(Some(d))
}

/// Package the current time and lunar-calendar data for direct injection into widget.data on mobile or desktop.
/// Returns: { solar, weekday, lunar, lunarYear, lunarMonth, lunarDay }
#[tauri::command]
pub fn get_calendar_widget_data() -> Result<serde_json::Value, String> {
    let now = chrono::Local::now();
    let date = now.date_naive();
    let info = calendar_service::get_lunar_info(Some(date))?;
    Ok(json!({
        "solar": info.solar,
        "weekday": calendar_service::weekday_name(date),
        "lunar": info.lunar,
        "lunarYear": info.lunar_year,
        "lunarMonth": info.lunar_month,
        "lunarDay": info.lunar_day,
    }))
}
