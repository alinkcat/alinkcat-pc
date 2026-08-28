/**
 * wttr.in (j1) / OpenWeatherMap 风格 JSON 的天气数据提取与图标映射。
 * 供 WebViewJSON 组件（PC 与主题通用）识别天气数据结构并做可视化渲染。
 */

export interface WeatherForecastDay {
  date: string;
  max: number | null;
  min: number | null;
  icon: string;
}

export interface WeatherExtracted {
  temp: number | null;
  feels: number | null;
  humidity: number | null;
  windSpeed: number | null; // km/h
  windDir: string | null;
  desc: string;
  icon: string;
  city: string | null;
  forecast: WeatherForecastDay[];
}

/** wttr.in 使用的 Met Office 天气代码 → emoji */
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

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 按天气代码取 emoji，无代码时按描述关键词兜底 */
export function weatherIconFor(code: number | null | undefined, desc?: string): string {
  if (code != null && CODE_ICONS[code]) return CODE_ICONS[code];
  const d = (desc || '').toLowerCase();
  if (/sun|clear/.test(d)) return '☀️';
  if (/thunder/.test(d)) return '⛈️';
  if (/snow|blizzard|sleet/.test(d)) return '❄️';
  if (/rain|drizzle|shower/.test(d)) return '🌧️';
  if (/fog|mist/.test(d)) return '🌫️';
  if (/cloud|overcast/.test(d)) return '☁️';
  return '🌤️';
}

function codeOf(holder: unknown): number | null {
  // holder 形如 [{ "value": "113" }]
  if (Array.isArray(holder) && holder[0] && typeof holder[0] === 'object') {
    return num((holder[0] as Record<string, unknown>).value);
  }
  return null;
}

/** 从任意 JSON 中提取天气数据；非天气结构返回 null */
export function extractWeather(data: unknown): WeatherExtracted | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;

  // ── wttr.in j1 格式 ──────────────────────────────
  const ccArr = obj.current_condition;
  if (Array.isArray(ccArr) && ccArr[0] && typeof ccArr[0] === 'object') {
    const cc = ccArr[0] as Record<string, unknown>;
    const desc = (cc.weatherDesc as any)?.[0]?.value || '';
    const code = codeOf(cc.weatherCode ?? cc.weathercode);
    const city = (obj.nearest_area as any)?.[0]?.areaName?.[0]?.value || null;
    const weatherArr = Array.isArray(obj.weather) ? (obj.weather as unknown[]) : [];
    const forecast: WeatherForecastDay[] = weatherArr.slice(0, 3).map(d => {
      const day = d as Record<string, unknown>;
      const hourly = Array.isArray(day.hourly) ? (day.hourly as unknown[]) : [];
      // 取中午（第 7 个点）的天气代码作代表
      const noonCode = codeOf((hourly[6] as Record<string, unknown>)?.weatherCode ?? (hourly[6] as Record<string, unknown>)?.weathercode);
      return {
        date: String(day.date || ''),
        max: num(day.maxtempC ?? day.tempMaxC),
        min: num(day.mintempC ?? day.tempMinC),
        icon: weatherIconFor(noonCode),
      };
    });
    return {
      temp: num(cc.temp_C),
      feels: num(cc.FeelsLikeC ?? cc.feelsLikeC),
      humidity: num(cc.humidity),
      windSpeed: num(cc.windspeedKmph),
      windDir: typeof cc.winddir16Point === 'string' ? cc.winddir16Point : null,
      desc,
      icon: weatherIconFor(code, desc),
      city,
      forecast,
    };
  }

  // ── OpenWeatherMap 格式 ──────────────────────────
  const main = obj.main as Record<string, unknown> | undefined;
  if (main && typeof main === 'object' && main.temp != null) {
    const w0 = Array.isArray(obj.weather) ? (obj.weather[0] as Record<string, unknown>) : undefined;
    const desc = w0?.description ? String(w0.description) : '';
    const wind = obj.wind as Record<string, unknown> | undefined;
    return {
      temp: num(main.temp),
      feels: num(main.feels_like),
      humidity: num(main.humidity),
      windSpeed: wind?.speed != null ? num(wind.speed) : null,
      windDir: null,
      desc,
      icon: weatherIconFor(w0?.id != null ? num(w0.id) : null, desc),
      city: typeof obj.name === 'string' ? obj.name : null,
      forecast: [],
    };
  }

  return null;
}
