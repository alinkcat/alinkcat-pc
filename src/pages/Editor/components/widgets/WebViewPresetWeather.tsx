import { useCallback, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { fetchWithMapping } from '../../../../services/fetch_generic_service';
import type { EditorWidget } from '../../types';

/**
 * 可配置的天气组件。所有请求细节（URL、method、header、body、附加参数）以及响应映射均从 widget JSON 中读取。
 * 通过 `fetchWithMapping` 完成占位符渲染、网络请求以及 JSON 路径映射，最终得到统一的天气数据结构。
 * 兼容旧版字段（weatherCity / weatherApiKey / weatherUnit / refreshInterval）。
 */

/** OpenWeatherMap 常用响应映射：目标字段 → JSON 路径 */
const OWM_MAPPING: Record<string, string> = {
  city: 'name',
  temp: 'main.temp',
  condition: 'weather[0].main',
  description: 'weather[0].description',
  icon: 'weather[0].icon',
  humidity: 'main.humidity',
  wind_speed: 'wind.speed',
  feels_like: 'main.feels_like',
  forecast: 'list',
};

/** OpenWeatherMap 默认请求地址（在未配置 requestUrl 时兜底使用） */
const OWM_URL = 'https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric';

export default function WeatherWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, any>;
  const { t } = useTranslation();

  // --- 读取 schema 定义的字段（含旧版字段兼容） ---------------------------------
  // 自定义 URL 判断：未设置或与默认 OWM 地址一致时视为「使用默认地址」，
  // 避免显式写入默认 URL 却仍被当成自定义地址、在缺少 API Key 时就去请求。
  const hasCustomUrl = !!v.requestUrl && String(v.requestUrl).trim() !== OWM_URL;
  const requestUrl = (v.requestUrl as string) || OWM_URL;
  const requestMethod = (v.requestMethod as string) ?? 'GET';
  const requestHeaders = v.requestHeaders as Record<string, string> | undefined;
  const requestBody = v.requestBody as string | undefined;

  const city = (v.city as string) || (v.weatherCity as string) || '';
  const apiKey = (v.apiKey as string) || (v.weatherApiKey as string) || '';
  const extraParams = v.extraParams as Record<string, string> | undefined;
  const unit = (v.unit as string) || (v.weatherUnit as string) || 'c';
  // refreshHours 按小时；兼容旧版 refreshInterval（秒）
  const refreshHours = Number(v.refreshHours ?? (v.refreshInterval ? (v.refreshInterval as number) / 3600 : 1));

  const responseMapping = (v.responseMapping as Record<string, string>) || OWM_MAPPING;

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 组合占位符变量 -----------------------------------------------------------
  const vars: Record<string, string | number> = {
    city,
    apiKey,
    unit,
    ...(extraParams || {}),
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWithMapping({
        requestUrl,
        requestMethod: requestMethod as 'GET' | 'POST',
        requestHeaders,
        requestBody,
        vars,
        responseMapping,
      });
      setInfo(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [requestUrl, requestMethod, requestHeaders, requestBody, vars, responseMapping]);

  useEffect(() => {
    fetchData();
    if (refreshHours > 0) {
      const id = setInterval(fetchData, refreshHours * 3600 * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refreshHours]);

  // ---------- UI 渲染 ------------------------------------------------------
  // 已配置判断：有自定义 URL 时需提供城市或 Key；无自定义 URL 时需同时提供城市与 Key（走默认 OWM）
  const configured = hasCustomUrl ? Boolean(city || apiKey) : Boolean(city && apiKey);
  if (!configured) {
    return (
      <div className="cw-webview-empty">
        <span style={{ fontSize: 28 }}>🌤️</span>
        <span>{t('common.weather.enterCity')}</span>
        <span className="cw-webview-hint">{t('common.weather.apiKeyHint')}</span>
      </div>
    );
  }

  if (loading && !info) return <div className="cw-webview-loading"><Spin size="small" /></div>;
  if (error) return <div className="cw-webview-error">{error}</div>;
  if (!info) return <div className="cw-webview-empty">{t('common.weather.noData')}</div>;

  const degree = unit === 'f' ? '°F' : '°C';
  const r = (n: any) => Math.round(Number(n) || 0);

  return (
    <div className="cw-weather">
      <div className="cw-weather-main">
        <div className="cw-weather-city">
          {info.city || city} <span style={{ fontSize: 26 }}>{info.icon || ''}</span>
        </div>
        <div className="cw-weather-temp">
          {r(info.temp)}<span className="cw-weather-unit">{degree}</span>
        </div>
        <div className="cw-weather-desc">{info.description}</div>
      </div>
      <div className="cw-weather-details">
        <div className="cw-weather-detail"><span>💧</span> {info.humidity != null ? `${info.humidity}%` : '--'}</div>
        <div className="cw-weather-detail"><span>🌬️</span> {info.wind_speed != null ? r(info.wind_speed) : '--'}</div>
        <div className="cw-weather-detail"><span>🌡️</span> {info.feels_like != null ? `${r(info.feels_like)}${degree}` : '--'}</div>
      </div>
      {info.forecast && info.forecast.length > 0 && (
        <div className="cw-weather-forecast">
          {info.forecast.map((day: any, i: number) => {
            // 兼容归一化字段与 OpenWeatherMap 原始字段
            const date = day.date || day.dt_txt || (day.dt ? new Date(day.dt * 1000).toISOString().slice(0, 10) : '');
            const tMax = day.temp_max ?? day.temp?.max ?? day.temp;
            const tMin = day.temp_min ?? day.temp?.min ?? day.temp;
            const icon = day.icon || day.weather?.[0]?.icon || '';
            return (
              <div key={day.date || day.dt || i} className="cw-weather-day">
                <div className="cw-weather-day-date">{date ? date.slice(5) : ''}</div>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div className="cw-weather-day-temps">
                  <span className="high">{r(tMax)}°</span>
                  <span className="low">{r(tMin)}°</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
