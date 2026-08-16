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

export const config = {
  get apiBaseUrl() {
    if (!loadDevMode()) return 'http://top.atqx.cn';
    const host = loadApiHost();
    const port = loadApiPort();
    if (host.includes('://')) return host.replace(/\/+$/, '');
    return `http://${host}:${port}`;
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