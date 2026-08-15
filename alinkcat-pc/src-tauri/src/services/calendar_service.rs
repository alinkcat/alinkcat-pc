use chrono::{Datelike, NaiveDate};
use serde::Serialize;

/// 轻量农历（阴历）转换：支持 1900-2100 年，无需外部依赖。
///
/// 数据表编码（每个 u32 表示一年）：
///   bit 0-3   ：闰月编号（0 表示无闰月）
///   bit 16    ：闰月是否为大月（30 天），否则 29 天
///   bit 15-3  ：第 1~12 月是否为大月（30 天），否则 29 天
const LUNAR_INFO: [u32; 201] = [
    // 1900-1999
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    // 2000-2099
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    // 2100
    0x0d520,
];

const GAN: [&str; 10] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI: [&str; 12] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const MONTH_NAMES: [&str; 12] = [
    "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月",
];
const DAY_NAMES: [&str; 30] = [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

/// 农历日期信息（可直接序列化供前端渲染）。
#[derive(Debug, Clone, Serialize)]
pub struct LunarInfo {
    /// 公历日期 "YYYY-MM-DD"
    pub solar: String,
    /// 干支纪年，如 "丙午"
    #[serde(rename = "lunarYear")]
    pub lunar_year: String,
    /// 农历月，如 "六月"，闰月为 "闰六月"
    #[serde(rename = "lunarMonth")]
    pub lunar_month: String,
    /// 农历日，如 "廿二"
    #[serde(rename = "lunarDay")]
    pub lunar_day: String,
    /// 完整农历字符串，如 "丙午年 闰六月廿二"
    pub lunar: String,
    /// 是否为闰月
    #[serde(rename = "isLeap")]
    pub is_leap: bool,
}

#[derive(Debug, Clone, Copy)]
struct LunarComputed {
    year: u32,
    month: u32,
    day: u32,
    is_leap: bool,
}

fn lunar_year_days(year: u32) -> u32 {
    let info = LUNAR_INFO[(year - 1900) as usize];
    let mut sum = 348u32;
    let mut bit = 0x8000u32;
    while bit > 0x8 {
        if info & bit != 0 {
            sum += 1;
        }
        bit >>= 1;
    }
    sum + leap_month_days(year)
}

fn leap_month(year: u32) -> u32 {
    (LUNAR_INFO[(year - 1900) as usize] & 0xf) as u32
}

fn leap_month_days(year: u32) -> u32 {
    let info = LUNAR_INFO[(year - 1900) as usize];
    if leap_month(year) == 0 {
        0
    } else if info & 0x10000 != 0 {
        30
    } else {
        29
    }
}

fn month_days(year: u32, month: u32) -> u32 {
    let info = LUNAR_INFO[(year - 1900) as usize];
    if info & (0x10000u32 >> month) != 0 {
        30
    } else {
        29
    }
}

fn ganzhi_year(year: u32) -> String {
    let gan = GAN[((year - 4) % 10) as usize];
    let zhi = ZHI[((year - 4) % 12) as usize];
    format!("{}{}", gan, zhi)
}

/// 公历 → 农历（支持 1900-2100）。
fn solar_to_lunar(date: NaiveDate) -> Option<LunarComputed> {
    let base = NaiveDate::from_ymd_opt(1900, 1, 31)?;
    let mut offset = date.signed_duration_since(base).num_days();
    if offset < 0 {
        return None;
    }

    let mut year = 1900u32;
    for y in 1900..=2100 {
        let days = lunar_year_days(y) as i64;
        if offset < days {
            year = y;
            break;
        }
        offset -= days;
        if y == 2100 {
            return None;
        }
    }

    let leap = leap_month(year);
    let mut month = 0u32;
    let mut is_leap = false;
    let mut found = false;
    for m in 1..=12 {
        let dim = month_days(year, m) as i64;
        if offset < dim {
            month = m;
            found = true;
            break;
        }
        offset -= dim;
        if leap == m {
            let ldim = leap_month_days(year) as i64;
            if offset < ldim {
                month = m;
                is_leap = true;
                found = true;
                break;
            }
            offset -= ldim;
        }
    }
    if !found {
        return None;
    }

    Some(LunarComputed { year, month, day: (offset + 1) as u32, is_leap })
}

/// 获取指定公历日期的农历信息；未传日期时默认使用今天。
pub fn get_lunar_info(date: Option<NaiveDate>) -> Result<LunarInfo, String> {
    let date = date.unwrap_or_else(|| chrono::Local::now().date_naive());
    let c = solar_to_lunar(date).ok_or_else(|| {
        format!("日期 {} 超出农历转换支持范围（1900-2100）", date)
    })?;

    let month_name = if c.is_leap {
        format!("闰{}", MONTH_NAMES[(c.month - 1) as usize])
    } else {
        MONTH_NAMES[(c.month - 1) as usize].to_string()
    };
    let day_name = DAY_NAMES[(c.day - 1) as usize].to_string();
    let gan_zhi = ganzhi_year(c.year);

    Ok(LunarInfo {
        solar: date.format("%Y-%m-%d").to_string(),
        lunar: format!("{}年{}{}", gan_zhi, month_name, day_name),
        lunar_year: gan_zhi,
        lunar_month: month_name,
        lunar_day: day_name,
        is_leap: c.is_leap,
    })
}

/// 公历日期对应的星期名称，如 "星期一"。
pub fn weekday_name(date: NaiveDate) -> &'static str {
    match date.weekday() {
        chrono::Weekday::Mon => "星期一",
        chrono::Weekday::Tue => "星期二",
        chrono::Weekday::Wed => "星期三",
        chrono::Weekday::Thu => "星期四",
        chrono::Weekday::Fri => "星期五",
        chrono::Weekday::Sat => "星期六",
        chrono::Weekday::Sun => "星期日",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_lunar(y: i32, m: u32, d: u32, year: &str, month: &str, day: &str) {
        let date = NaiveDate::from_ymd_opt(y, m, d).unwrap();
        let info = get_lunar_info(Some(date)).unwrap();
        assert_eq!(info.lunar_year, year, "{}-{}-{}", y, m, d);
        assert_eq!(info.lunar_month, month, "{}-{}-{}", y, m, d);
        assert_eq!(info.lunar_day, day, "{}-{}-{}", y, m, d);
    }

    #[test]
    fn known_dates() {
        assert_lunar(2024, 2, 10, "甲辰", "正月", "初一"); // 2024 春节
        assert_lunar(2023, 1, 22, "癸卯", "正月", "初一"); // 2023 春节
        assert_lunar(2000, 2, 5, "庚辰", "正月", "初一"); // 2000 春节
        assert_lunar(1949, 10, 1, "己丑", "八月", "初十"); // 开国大典
        assert_lunar(2023, 9, 29, "癸卯", "八月", "十五"); // 2023 中秋
    }

    #[test]
    fn leap_month() {
        // 2023 年闰二月，公历 2023-03-23 ≈ 农历闰二月初二
        let date = NaiveDate::from_ymd_opt(2023, 3, 23).unwrap();
        let info = get_lunar_info(Some(date)).unwrap();
        assert_eq!(info.lunar_month, "闰二月");
        assert!(info.is_leap);
    }

    #[test]
    fn today_works() {
        let info = get_lunar_info(None).unwrap();
        assert!(!info.solar.is_empty());
        assert!(info.lunar.len() >= 5);
    }
}
