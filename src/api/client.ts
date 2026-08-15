import { tauriInvoke } from '../utils/tauri';
import type { ApiResponse, LoginResult } from './types';
import { config } from '../config';

function baseUrl() { return config.apiBaseUrl; }
const TOKEN_KEY = 'ilinkcat_access_token';
const REFRESH_KEY = 'ilinkcat_refresh_token';

/** 下划线命名 → 驼峰命名（如 cover_url → coverUrl） */
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** 递归转换对象所有 key 为驼峰 */
function snakeToCamel<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => snakeToCamel(v)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toCamel(k)] = snakeToCamel(v);
    }
    return out as T;
  }
  return value as T;
}

let refreshing: Promise<string> | null = null;

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** 通过 Rust 后端发起 HTTP 请求（绕过 CORS） */
async function rustFetch(
  url: string,
  method: string = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  const result = await tauriInvoke<{ status: number; body: unknown }>('api_request', {
    url,
    method: method || undefined,
    body: body !== undefined ? body : undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  return result;
}

async function doRefresh(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('No refresh token');
  const resp = await rustFetch(`${baseUrl()}/api/auth/refresh`, 'POST', { refreshToken: refresh });
  if (resp.status >= 400) throw new Error('Refresh failed');
  const result = snakeToCamel<ApiResponse<LoginResult>>(resp.body);
  if (result.code !== 200) throw new Error(result.message);
  setTokens(result.data.accessToken, result.data.refreshToken);
  return result.data.accessToken;
}

async function authHeaders(): Promise<Record<string, string>> {
  let token = getAccessToken();
  if (!token) return {};
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000 - 30_000) {
      if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
      token = await refreshing;
    }
  } catch { /* not a valid JWT, still send it */ }
  return { Authorization: `Bearer ${token}` };
}

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { body, headers: extra, method } = opts;
  const auth = await authHeaders();
  const url = `${baseUrl()}${path}`;
  const httpMethod = (method as string) || 'GET';

  try {
    console.log(`[API] → ${httpMethod} ${url}`);
    const resp = await rustFetch(url, httpMethod, body, { ...auth, ...(extra as Record<string, string>) });
    console.log(`[API] ← ${resp.status} ${url}`);

    if (resp.status === 401) {
      try {
        const newToken = await doRefresh();
        const retry = await rustFetch(url, httpMethod, body, {
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
          ...(extra as Record<string, string>),
        });
        if (retry.status >= 400) throw new Error(`HTTP ${retry.status}`);
        return snakeToCamel<T>(retry.body);
      } catch {
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('登录已过期，请重新登录');
      }
    }

    if (resp.status >= 400) {
      let text = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
      try {
        const json = typeof resp.body === 'object' ? resp.body as Record<string, unknown> : JSON.parse(text);
        if (json && typeof json === 'object' && 'message' in json) text = String(json.message);
      } catch { /* not JSON */ }
      console.error(`[API] ${resp.status} ${url}:`, text);
      throw new Error(text || `HTTP ${resp.status}`);
    }

    return snakeToCamel<T>(resp.body);
  } catch (e) {
    if (e instanceof Error && e.message.includes('login')) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[API] fetch failed: ${url}`, e);
    throw new Error(msg.includes('request') ? '网络连接失败，请检查后端服务是否启动' : msg);
  }
}

/** Upload multipart form (for theme upload, etc.) — uses browser fetch (Tauri 不拦截 multipart 的 CORS) */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  const auth = await authHeaders();
  const url = `${baseUrl()}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: auth,
    body: formData,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return (await resp.json()) as T;
}