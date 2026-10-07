const DEV_KEY = 'ilinkcat_dev_mode';
const API_HOST_KEY = 'ilinkcat_api_host';
const API_PORT_KEY = 'ilinkcat_api_port';

function loadDevMode(): boolean {
  return localStorage.getItem(DEV_KEY) === 'true';
}

function loadApiHost(): string {
  return localStorage.getItem(API_HOST_KEY) || 'localhost';
}

function loadApiPort(): string {
  return localStorage.getItem(API_PORT_KEY) || '8080';
}

/**
 * build-time env vars (injected by Vite):
 *   .env.development → pnpm dev / tauri dev → local API
 *   .env.production  → pnpm build / tauri build → cloud API
 *
 * there's also a "dev mode" override (runtime localStorage, highest priority),
 * unlocked by clicking the Settings title 5 times — points a built package at a local backend.
 */
const BUILD_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const config = {
  get apiBaseUrl() {
    // 1) runtime dev mode (highest priority, for debugging built packages)
    if (loadDevMode()) {
      const host = loadApiHost();
      const port = loadApiPort();
      if (host.includes('://')) return host.replace(/\/+$/, '');
      return `http://${host}:${port}`;
    }
    // 2) build-time env var (dev → local, prod → cloud)
    if (BUILD_API_BASE) return BUILD_API_BASE;
    // 3) fallback (https only, no plain http)
    return 'https://api.pynen.com';
  },
  wsPort: 9527,
};

export const APP_VERSION = '0.1.1';

// version gate / announcement target platform, derived from the webview UA
export const APP_PLATFORM = /mac/i.test(navigator.userAgent) ? 'macos' : 'windows';

export const devConfig = {
  get enabled() { return loadDevMode(); },
  set enabled(v: boolean) { localStorage.setItem(DEV_KEY, String(v)); },
  get host() { return loadApiHost(); },
  set host(v: string) { localStorage.setItem(API_HOST_KEY, v); },
  get port() { return loadApiPort(); },
  set port(v: string) { localStorage.setItem(API_PORT_KEY, v); },
};