import { useCallback, useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';
import { extractWeather, type WeatherExtracted } from '../../../../utils/weatherJson';

// module-level cache：avoid duplicate requests on page switch/remount，only re-fetch when past the refresh interval
const jsonCache = new Map<string, { data: unknown; at: number }>();

function getCachedJson(url: string, ttlMs: number): unknown | undefined {
  const hit = jsonCache.get(url);
  if (!hit) return undefined;
  return Date.now() - hit.at < ttlMs ? hit.data : undefined;
}

function setCachedJson(url: string, data: unknown) {
  jsonCache.set(url, { data, at: Date.now() });
}

function getField(item: Record<string, unknown>, field: string): unknown {
  if (!field) return undefined;
  if (field.includes('.')) {
    let cur: unknown = item;
    for (const seg of field.split('.')) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[seg];
      else return undefined;
    }
    return cur;
  }
  return item[field];
}

function renderValue(data: unknown, cfg: {
  titleField: string; descField: string; timeField: string; linkField: string;
}, t: (key: string, opts?: Record<string, unknown>) => string): React.ReactNode {
  if (Array.isArray(data)) {
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noData')} style={{ padding: 20 }} />;

    const first = data[0];
    if (first && typeof first === 'object') {
      // object array → card list（using field mapping）
      return (
        <div className="cw-json-list">
          {data.map((raw, i) => {
            const item = raw as Record<string, unknown>;
            const title = String(getField(item, cfg.titleField) ?? t('common.widgets.webview.item', { index: i + 1 }));
            const desc = getField(item, cfg.descField) ? String(getField(item, cfg.descField)) : '';
            const time = getField(item, cfg.timeField) ? String(getField(item, cfg.timeField)) : '';
            const link = getField(item, cfg.linkField) ? String(getField(item, cfg.linkField)) : '';
            return (
              <div
                key={i}
                className="cw-json-item"
                onClick={() => { if (link) window.open(link, '_blank', 'noopener'); }}
              >
                <div className="cw-json-title">{title}</div>
                {time && <div className="cw-json-date">{time}</div>}
                {desc && <div className="cw-json-desc">{desc}</div>}
              </div>
            );
          })}
        </div>
      );
    }
    // primitive array → simple list
    return (
      <div className="cw-json-list">
        {data.map((val, i) => (
          <div key={i} className="cw-json-item">{String(val)}</div>
        ))}
      </div>
    );
  }

  if (data && typeof data === 'object') {
    // object → key-value pairs
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div className="cw-json-kv">
        {entries.map(([k, val]) => (
          <div key={k} className="cw-json-kv-row">
            <span className="cw-json-kv-key">{k}</span>
            <span className="cw-json-kv-val">
              {val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <div className="cw-json-kv"><div className="cw-json-kv-row"><span>{String(data)}</span></div></div>;
}

export default function WebViewJSON({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const url = (v.jsonUrl as string) || '';
  const titleField = (v.titleField as string) || 'title';
  const descField = (v.descField as string) || 'description';
  const timeField = (v.timeField as string) || 'pubDate';
  const linkField = (v.linkField as string) || 'link';
  const refresh = (v.refreshInterval as number) || 0;
  const headers = (v.headers as Record<string, string>) || {};
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      // generic_http supports custom headers（JWT auth），and does not check HTTP status，
      // 401/403 errors are determined via body.code（gateway HTTP status is unreliable）
      const json = await tauriInvoke<unknown>('generic_http', {
        url,
        method: 'GET',
        headers,
        body: null,
      });
      const obj = json as Record<string, unknown> | null;
      // backend gateway：code != 200 is an error（403 quota / 429 rate / 500 upstream down / 401 not logged in）
      if (obj && typeof obj.code === 'number' && obj.code !== 200) {
        setError(String(obj.message || `error code: ${obj.code}`));
        setData(null);
        return;
      }
      // unwrap { code, message, data: {...} } → take the inner weather structure
      const inner = obj?.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
        ? obj.data
        : json;
      setCachedJson(url, inner);
      setData(inner);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [url, headers]);

  useEffect(() => {
    // cache hit and within refresh interval → show directly，avoid duplicate requests on page switch/remount
    const ttl = (refresh > 0 ? refresh : 3600) * 1000;
    const cached = getCachedJson(url, ttl);
    if (cached !== undefined) {
      setData(cached);
    } else {
      load();
    }
    if (refresh > 0) {
      const id = setInterval(load, refresh * 1000);
      return () => clearInterval(id);
    }
  }, [url, refresh, load]);

  if (!url) {
    return (
      <div className="cw-webview-empty">
        <GlobalOutlined style={{ fontSize: 28, color: '#ccc' }} />
        <span>{t('common.widgets.webview.enterJsonUrl')}</span>
        <span className="cw-webview-hint">{t('common.widgets.webview.panelHint')}</span>
      </div>
    );
  }

  if (loading && data === null) {
    return <div className="cw-webview-loading"><Spin size="small" /></div>;
  }

  if (error) {
    return <div className="cw-webview-error">{error}</div>;
  }

  const weather = extractWeather(data);
  return (
    <div className="cw-json-wrap">
      {weather ? <WeatherDashboard weather={weather} /> : renderValue(data, { titleField, descField, timeField, linkField }, t)}
    </div>
  );
}

/** wttr.in / OpenWeatherMap structure → visual weather dashboard */
function WeatherDashboard({ weather }: { weather: WeatherExtracted }) {
  const { t } = useTranslation();
  const r = (n: number | null) => (n != null ? Math.round(n) : null);
  return (
    <div className="cw-weather">
      <div className="cw-weather-main">
        <div className="cw-weather-city">
          {weather.city || t('weather.title')} <span style={{ fontSize: 26 }}>{weather.icon}</span>
        </div>
        <div className="cw-weather-temp">
          {r(weather.temp) ?? '--'}<span className="cw-weather-unit">°C</span>
        </div>
        <div className="cw-weather-desc">{weather.desc}</div>
      </div>
      <div className="cw-weather-details">
        <div className="cw-weather-detail"><span>💧</span> {weather.humidity != null ? `${weather.humidity}%` : '--'}</div>
        <div className="cw-weather-detail"><span>🌬️</span> {weather.windSpeed != null ? `${r(weather.windSpeed)} km/h${weather.windDir ? ` ${weather.windDir}` : ''}` : '--'}</div>
        <div className="cw-weather-detail"><span>🌡️</span> {r(weather.feels) != null ? `${r(weather.feels)}°` : '--'}</div>
      </div>
      {weather.forecast.length > 0 && (
        <div className="cw-weather-forecast">
          {weather.forecast.map((d, i) => (
            <div key={i} className="cw-weather-day">
              <div className="cw-weather-day-date">{d.date ? d.date.slice(5) : ''}</div>
              <span style={{ fontSize: 20 }}>{d.icon}</span>
              <div className="cw-weather-day-temps">
                <span className="high">{r(d.max) ?? '--'}°</span>
                <span className="low">{r(d.min) ?? '--'}°</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}