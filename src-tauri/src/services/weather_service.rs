use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeatherInfo {
    pub city: String,
    pub temp: f64,
    pub condition: String,
    pub description: String,
    pub icon: String,
    pub humidity: i64,
    pub wind_speed: f64,
    pub feels_like: f64,
    pub forecast: Vec<ForecastDay>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastDay {
    pub date: String,
    pub temp_max: f64,
    pub temp_min: f64,
    pub condition: String,
    pub icon: String,
}

fn map_condition(main: &str) -> &'static str {
    match main.to_lowercase().as_str() {
        "clear" => "sunny",
        "clouds" => "cloudy",
        "rain" | "drizzle" | "thunderstorm" => "rainy",
        "snow" => "snowy",
        "fog" | "mist" | "haze" => "foggy",
        _ => "cloudy",
    }
}

/// Fetch current weather and a three-day forecast (OpenWeatherMap).
pub async fn fetch_weather(city: &str, api_key: &str, unit: &str) -> Result<WeatherInfo, String> {
    let units = if unit == "f" { "imperial" } else { "metric" };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {}", e))?;

    // Current weather
    let url = format!(
        "https://api.openweathermap.org/data/2.5/weather?q={}&appid={}&units={}",
        city, api_key, units
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("network request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("weather API request failed, status: {}", resp.status()));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("failed to parse response: {}", e))?;

    let main = &json["main"];
    let weather = json["weather"]
        .as_array()
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or_default();
    let condition_main = weather["main"].as_str().unwrap_or("");

    let mut info = WeatherInfo {
        city: json["name"].as_str().unwrap_or(city).to_string(),
        temp: main["temp"].as_f64().unwrap_or(0.0),
        condition: map_condition(condition_main).to_string(),
        description: weather["description"].as_str().unwrap_or("").to_string(),
        icon: weather["icon"].as_str().unwrap_or("").to_string(),
        humidity: main["humidity"].as_i64().unwrap_or(0),
        wind_speed: json["wind"]["speed"].as_f64().unwrap_or(0.0),
        feels_like: main["feels_like"].as_f64().unwrap_or(0.0),
        forecast: Vec::new(),
    };

    // Three-day forecast (failure does not block the main data)
    let forecast_url = format!(
        "https://api.openweathermap.org/data/2.5/forecast?q={}&appid={}&units={}",
        city, api_key, units
    );
    if let Ok(resp2) = client.get(&forecast_url).send().await {
        if let Ok(json2) = resp2.json::<serde_json::Value>().await {
            info.forecast = parse_forecast(&json2);
        }
    }

    Ok(info)
}

fn parse_forecast(json: &serde_json::Value) -> Vec<ForecastDay> {
    use std::collections::HashMap;

    let mut by_date: HashMap<String, (f64, f64, String, String)> = HashMap::new();

    if let Some(list) = json["list"].as_array() {
        for item in list.iter() {
            let dt_txt = item["dt_txt"].as_str().unwrap_or("");
            if dt_txt.len() < 10 {
                continue;
            }
            let date = &dt_txt[..10];
            let tmax = item["main"]["temp_max"].as_f64().unwrap_or(0.0);
            let tmin = item["main"]["temp_min"].as_f64().unwrap_or(0.0);
            let wmain = item["weather"]
                .as_array()
                .and_then(|a| a.first())
                .map(|w| w["main"].as_str().unwrap_or(""))
                .unwrap_or("");
            let icon = item["weather"]
                .as_array()
                .and_then(|a| a.first())
                .map(|w| w["icon"].as_str().unwrap_or(""))
                .unwrap_or("");

            let entry = by_date
                .entry(date.to_string())
                .or_insert((tmax, tmin, map_condition(wmain).to_string(), icon.to_string()));
            entry.0 = entry.0.max(tmax);
            entry.1 = entry.1.min(tmin);
        }
    }

    let mut days: Vec<ForecastDay> = by_date
        .into_iter()
        .map(|(date, (temp_max, temp_min, condition, icon))| ForecastDay {
            date,
            temp_max,
            temp_min,
            condition,
            icon,
        })
        .collect();

    days.sort_by(|a, b| a.date.cmp(&b.date));
    days.truncate(3);
    days
}
