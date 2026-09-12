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
 * 构建时环境变量（Vite 注入）：
 *   .env.development → pnpm dev / tauri dev → 本地接口
 *   .env.production  → pnpm build / tauri build → 云端接口
 *
 * 此外保留「开发者模式」（运行时 localStorage）作为最高优先级覆盖，
 * 点 Settings 标题 5 次解锁，用于调试已构建的包指向本地后端。
 */
const BUILD_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const config = {
  get apiBaseUrl() {
    // 1) 运行时开发者模式（最高优先级，用于调试生产包）
    if (loadDevMode()) {
      const host = loadApiHost();
      const port = loadApiPort();
      if (host.includes('://')) return host.replace(/\/+$/, '');
      return `http://${host}:${port}`;
    }
    // 2) 构建时环境变量（dev→本地，prod→云端）
    if (BUILD_API_BASE) return BUILD_API_BASE;
    // 3) 回退
    return 'http://top.atqx.cn';
  },
  wsPort: 9527,
};

export const APP_VERSION = '0.1.1';

export const devConfig = {
  get enabled() { return loadDevMode(); },
  set enabled(v: boolean) { localStorage.setItem(DEV_KEY, String(v)); },
  get host() { return loadApiHost(); },
  set host(v: string) { localStorage.setItem(API_HOST_KEY, v); },
  get port() { return loadApiPort(); },
  set port(v: string) { localStorage.setItem(API_PORT_KEY, v); },
};