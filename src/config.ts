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
 * build-time env vars（Vite injected）：
 *   .env.development → pnpm dev / tauri dev → local API
 *   .env.production  → pnpm build / tauri build → cloud API
 *
 * also keep「dev mode」（runtime localStorage）highest-priority override，
 * tap the Settings title 5 times to unlock，for pointing a built package at a local backend。
 */
const BUILD_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const config = {
  get apiBaseUrl() {
    // 1) runtime dev mode（highest priority，for debugging production builds）
    if (loadDevMode()) {
      const host = loadApiHost();
      const port = loadApiPort();
      void port; // uncomment to switch to cloud during debugging
      if (host.includes('://')) return host.replace(/\/+$/, '');
      // temporarily switch to the cloud server
      // return `http://${host}:${port}`;
      return 'https://api.pynen.com';
    }
    // 2) build-time env vars（dev→local, prod→cloud）
    if (BUILD_API_BASE) return BUILD_API_BASE;
    // 3) fallback
    return 'https://www.pynen.com';
  },
  wsPort: 9527,
};

export const APP_VERSION = '0.1.2-1';

export const devConfig = {
  get enabled() { return loadDevMode(); },
  set enabled(v: boolean) { localStorage.setItem(DEV_KEY, String(v)); },
  get host() { return loadApiHost(); },
  set host(v: string) { localStorage.setItem(API_HOST_KEY, v); },
  get port() { return loadApiPort(); },
  set port(v: string) { localStorage.setItem(API_PORT_KEY, v); },
};