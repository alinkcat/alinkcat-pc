import { useCallback, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';

interface ForecastDay {
  date: string;
  temp_max: number;
  temp_min: number;
  condition: string;
  icon: string;
}

interface WeatherInfo {
  city: string;
  temp: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  feels_like: number;
  forecast: ForecastDay[];
}

const CONDITION_ICONS: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', foggy: '🌫️',
};

function WeatherIcon({ condition }: { condition: string }) {
  return <span style={{ fontSize: 26 }}>{CONDITION_ICONS[condition] || '🌤️'}</span>;
}

export default function WebViewPresetWeather({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const city = (v.weatherCity as string) || '';
  const apiKey = (v.weatherApiKey as string) || '';
  const unit = (v.weatherUnit as string) || 'c';
  const refreshSec = (v.refreshInterval as number) || 600;
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!city || !apiKey) return;
    setLoading(true);
    setError('');
    try {
      const data = await tauriInvoke<WeatherInfo>('fetch_weather', { city, apiKey, unit });
      setInfo(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [city, apiKey, unit]);

  useEffect(() => {
    fetchData();
    if (refreshSec > 0) {
      const id = setInterval(fetchData, refreshSec * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refreshSec]);

  if (!city || !apiKey) {
    return (
      <div className="cw-webview-empty">
        <span style={{ fontSize: 28 }}>🌤️</span>
        <span>请输入城市和 API Key</span>
        <span className="cw-webview-hint">需配置 OpenWeatherMap API Key</span>
      </div>
    );
  }

  if (loading && !info) {
    return <div className="cw-webview-loading"><Spin size="small" /></div>;
  }

  if (error) {
    return <div className="cw-webview-error">{error}</div>;
  }

  if (!info) {
    return <div className="cw-webview-empty">暂无数据</div>;
  }

  const degree = unit === 'f' ? '°F' : '°C';

  return (
    <div className="cw-weather">
      <div className="cw-weather-main">
        <div className="cw-weather-city">
          {info.city} <WeatherIcon condition={info.condition} />
        </div>
        <div className="cw-weather-temp">
          {Math.round(info.temp)}<span className="cw-weather-unit">{degree}</span>
        </div>
        <div className="cw-weather-desc">{info.description}</div>
      </div>
      <div className="cw-weather-details">
        <div className="cw-weather-detail"><span>💧</span> {info.humidity}%</div>
        <div className="cw-weather-detail"><span>🌬️</span> {Math.round(info.wind_speed)}</div>
        <div className="cw-weather-detail"><span>🌡️</span> {Math.round(info.feels_like)}{degree}</div>
      </div>
      {info.forecast.length > 0 && (
        <div className="cw-weather-forecast">
          {info.forecast.map((day) => (
            <div key={day.date} className="cw-weather-day">
              <div className="cw-weather-day-date">{day.date.slice(5)}</div>
              <WeatherIcon condition={day.condition} />
              <div className="cw-weather-day-temps">
                <span className="high">{Math.round(day.temp_max)}°</span>
                <span className="low">{Math.round(day.temp_min)}°</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
