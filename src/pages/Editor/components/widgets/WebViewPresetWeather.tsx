import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { fetchWithMapping } from '../../../../services/fetch_generic_service';
import type { EditorWidget } from '../../types';

/**
 * configurable weather widget. All request details(URL, method, header, body, extra params）and response mapping are read from the widget JSON。
 * via `fetchWithMapping` handles placeholder rendering, HTTP request, and JSON path mapping，produces a unified weather data structure。
 * compatible with legacy fields（weatherCity / weatherApiKey / weatherUnit / refreshInterval）。
 */

/** common response mapping for the self-hosted weather API：target field → JSON path（backend returns the wttr.in j1 structure） */
const OWM_MAPPING: Record<string, string> = {
  city: 'nearest_area[0].areaName[0].value',
  temp: 'current_condition[0].temp_C',
  condition: 'current_condition[0].weatherDesc[0].value',
  description: 'current_condition[0].weatherDesc[0].value',
  icon: 'current_condition[0].weatherCode',
  humidity: 'current_condition[0].humidity',
  wind_speed: 'current_condition[0].windspeedKmph',
  feels_like: 'current_condition[0].FeelsLikeC',
  forecast: 'weather',
};

/** default request URL for the self-hosted weather API（no login required，X-API-Key auth，key injected by the Android client；fallback when requestUrl is not set） */
const OWM_URL = 'https://www.pynen.com/api/public/weather?q=${city}&f=wttr';

/** wttr.in Met Office weather code → emoji（matches the Android client） */
const CODE_ICONS: Record<number, string> = {
  113: '☀️', 116: '⛅', 119: '☁️', 122: '☁️', 143: '🌫️',
  176: '🌦️', 179: '🌨️', 182: '🌧️', 185: '🌧️', 200: '⛈️',
  227: '❄️', 230: '❄️', 248: '🌫️', 260: '🌫️', 263: '🌧️',
  266: '🌧️', 281: '🌧️', 284: '🌧️', 293: '🌧️', 296: '🌧️',
  299: '🌧️', 302: '🌧️', 305: '🌧️', 308: '🌧️', 311: '🌧️',
  314: '🌧️', 317: '🌨️', 320: '🌨️', 323: '❄️', 326: '❄️',
  329: '❄️', 332: '❄️', 335: '❄️', 338: '❄️', 350: '🧊',
  353: '🌦️', 356: '🌧️', 359: '🌧️', 362: '🌨️', 365: '🌨️',
  368: '❄️', 371: '❄️', 374: '🌨️', 377: '🌨️', 386: '⛈️',
  389: '⛈️', 392: '⛈️', 395: '❄️',
};

function weatherIconFor(code: any, desc: string): string {
  const n = Number(code);
  if (Number.isInteger(n) && CODE_ICONS[n]) return CODE_ICONS[n];
  const d = (desc || '').toLowerCase();
  if (d.includes('sun') || d.includes('clear')) return '☀️';
  if (d.includes('thunder')) return '⛈️';
  if (d.includes('snow') || d.includes('blizzard') || d.includes('sleet')) return '❄️';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return '🌧️';
  if (d.includes('fog') || d.includes('mist')) return '🌫️';
  if (d.includes('cloud') || d.includes('overcast')) return '☁️';
  return '🌤️';
}

/** wttr.in j1 daily forecast：conditions/icon are in hourly[0]（weatherDesc / weatherCode），not at the top level */
function dayIcon(day: any): string {
  const icon = day.icon || day.weather?.[0]?.icon || '';
  if (icon) return weatherIconFor(icon, day.description || '');
  const h0 = Array.isArray(day.hourly) ? day.hourly[0] : undefined;
  if (h0) {
    const code = h0.weatherCode ?? h0.weathercode;
    const desc = h0.weatherDesc?.[0]?.value ?? '';
    return weatherIconFor(code, desc);
  }
  return weatherIconFor(null, day.condition || day.description || '');
}

export default function WeatherWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, any>;
  const { t } = useTranslation();

  // --- read schema-defined fields（including legacy field compat） ---------------------------------
  // custom URL detection：when unset or equal to the default OWM URL, treat as「using the default URL」，
  // avoid treating an explicit default URL as custom、and sending a request without an API key。
  const hasCustomUrl = !!v.requestUrl && String(v.requestUrl).trim() !== OWM_URL;
  const requestUrl = (v.requestUrl as string) || OWM_URL;
  const requestMethod = (v.requestMethod as string) ?? 'GET';
  const requestHeaders = v.requestHeaders as Record<string, string> | undefined;
  const requestBody = v.requestBody as string | undefined;

  const city = (v.city as string) || (v.weatherCity as string) || '';
  const apiKey = (v.apiKey as string) || (v.weatherApiKey as string) || '';
  const extraParams = v.extraParams as Record<string, string> | undefined;
  const unit = (v.unit as string) || (v.weatherUnit as string) || 'c';
  // refreshHours per hour；compatible with legacy refreshInterval（seconds）
  const refreshHours = Number(v.refreshHours ?? (v.refreshInterval ? (v.refreshInterval as number) / 3600 : 1));

  const responseMapping = (v.responseMapping as Record<string, string>) || OWM_MAPPING;

  // weather key saved locally after applying on the member page：PC preview auto-injects X-API-Key，no manual entry needed
  const savedKey = (typeof localStorage !== 'undefined' ? localStorage.getItem('ilinkcat_weather_key') : null) || '';
  const effectiveKey = apiKey || savedKey;

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // compose placeholder variables（useMemo for stable identity，prevent re-triggering fetchData/effect on every render）
  const vars: Record<string, string | number> = useMemo(() => ({
    city,
    apiKey: effectiveKey,
    unit,
    ...(extraParams || {}),
  }), [city, effectiveKey, unit, extraParams]);

  // auto-inject auth header：add X-API-Key when using the default URL and a local key exists
  const headers: Record<string, string> = useMemo(() => {
    const h: Record<string, string> = { ...(requestHeaders || {}) };
    if (!hasCustomUrl && effectiveKey && !Object.keys(h).some(k => k.toLowerCase() === 'x-api-key')) {
      h['X-API-Key'] = effectiveKey;
    }
    return h;
  }, [requestHeaders, hasCustomUrl, effectiveKey]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWithMapping({
        requestUrl,
        requestMethod: requestMethod as 'GET' | 'POST',
        requestHeaders: headers,
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
  }, [requestUrl, requestMethod, headers, requestBody, vars, responseMapping]);

  useEffect(() => {
    fetchData();
    if (refreshHours > 0) {
      const id = setInterval(fetchData, refreshHours * 3600 * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refreshHours]);

  // ---------- UI rendering ------------------------------------------------------
  // configured check：with the default URL, only a city is needed（Key auto-injected from the member-page key）；
  // with a custom URL, provide a city or a key。
  const configured = hasCustomUrl ? Boolean(city || effectiveKey) : Boolean(city);
  if (!configured) {
    return (
      <div className="cw-webview-empty">
        <span style={{ fontSize: 28 }}>🌤️</span>
        <span>{t('common.weather.enterCity')}</span>
        <span className="cw-webview-hint">{t('common.weather.apiKeyHint')}</span>
      </div>
    );
  }
  // default URL + has city but no key：do not send a request（avoid 401），prompt to apply at the member center first
  if (!hasCustomUrl && !effectiveKey) {
    return (
      <div className="cw-webview-empty">
        <span style={{ fontSize: 28 }}>🔑</span>
        <span>{t('common.weather.applyKey')}</span>
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
          {info.city || city} <span style={{ fontSize: 26 }}>{weatherIconFor(info.icon, info.description || '')}</span>
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
            // compat with normalized fields / wttr.in（maxtempC / mintempC）/ OpenWeatherMap raw fields
            const date = day.date || day.dt_txt || (day.dt ? new Date(day.dt * 1000).toISOString().slice(0, 10) : '');
            const tMax = day.temp_max ?? day.maxtempC ?? day.temp?.max ?? day.temp;
            const tMin = day.temp_min ?? day.mintempC ?? day.temp?.min ?? day.temp;
            return (
              <div key={day.date || day.dt || i} className="cw-weather-day">
                <div className="cw-weather-day-date">{date ? date.slice(5) : ''}</div>
                <span style={{ fontSize: 20 }}>{dayIcon(day)}</span>
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
