use chrono::NaiveDate;
use serde_json::json;

use crate::services::calendar_service::{self, LunarInfo};

/// 获取指定公历日期的农历信息。
/// date 参数格式 "YYYY-MM-DD"，省略时返回今天的农历。
#[tauri::command]
pub fn get_lunar_info(date: Option<String>) -> Result<LunarInfo, String> {
    let d = match date {
        Some(s) => NaiveDate::parse_from_str(&s, "%Y-%m-%d")
            .map_err(|e| format!("日期格式错误（应为 YYYY-MM-DD）: {}", e))?,
        None => chrono::Local::now().date_naive(),
    };
    calendar_service::get_lunar_info(Some(d))
}

/// 当前时间 + 农历打包数据，可直接注入 widget.data 供移动端/PC 端渲染。
/// 返回：{ solar, weekday, lunar, lunarYear, lunarMonth, lunarDay }
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
