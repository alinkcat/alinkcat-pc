import { isTauri, tauriInvoke } from '../utils/tauri';
import type { ApiResponse, LoginResult } from './types';
import { config } from '../config';

function baseUrl() { return config.apiBaseUrl; }
const TOKEN_KEY = 'ilinkcat_access_token';
const REFRESH_KEY = 'ilinkcat_refresh_token';

/** snake_case → camelCase（e.g. cover_url → coverUrl） */
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** recursively convert all object keys to camelCase */
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

/** whether this session already triggered the 'auth expired' modal（only once per session，resettable after successful login） */
let authExpiredNotified = false;
export function resetAuthExpiredFlag() {
  authExpiredNotified = false;
}

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

/** send HTTP requests via the Rust backend（bypass CORS） */
async function rustFetch(
  url: string,
  method: string = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  // non-Tauri env（e.g. opening the Vite page directly in a browser for debugging）has no IPC, falls back to browser fetch。
  // note: cross-origin requests in a direct browser open require backend CORS；behavior inside the Tauri window is unchanged。
  if (!isTauri()) {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* non-JSON response, keep raw text */ }
    return { status: resp.status, body: parsed };
  }
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
      // no token（unauthenticated user hitting a protected endpoint）→ fail silently，do not show"auth expired"
      if (!getAccessToken()) {
        throw new Error('not authenticated');
      }
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
        // auth-expired modal：only once per session
        if (!authExpiredNotified) {
          authExpiredNotified = true;
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        throw new Error('session expired, please log in again');
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
    throw new Error(msg.includes('request') ? 'network connection failed, check if the backend service is running' : msg);
  }
}

/** Upload multipart form (for theme upload, etc.) — uses browser fetch (Tauri does not intercept multipart CORS) */
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