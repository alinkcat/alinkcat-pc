import { APP_VERSION } from '../config';
import { tauriInvoke } from './tauri';

const DEVICE_CODE_KEY = 'ilinkcat_device_code';

/** generate a UUID v4 */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** get the device unique id（prefer Rust disk persistence, fall back to localStorage） */
export async function getDeviceCode(): Promise<string> {
  try {
    return await tauriInvoke<string>('get_device_code');
  } catch { /* non-Tauri env */ }
  let code = localStorage.getItem(DEVICE_CODE_KEY);
  if (!code) {
    code = generateUUID();
    localStorage.setItem(DEVICE_CODE_KEY, code);
  }
  return code;
}

/** check if running in a Tauri desktop env */
function isDesktop(): boolean {
  try { return '__TAURI_INTERNALS__' in window; } catch { return false; }
}

/** parse OS name and version */
function detectOS(): { name: string; version: string } {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) {
    const m = ua.match(/Windows NT (\d+\.?\d*)/);
    const versions: Record<string, string> = {
      '10': 'Windows 10', '6.3': 'Windows 8.1', '6.2': 'Windows 8',
      '6.1': 'Windows 7', '11': 'Windows 11',
    };
    const v = m ? (versions[m[1]] || `Windows ${m[1]}`) : 'Windows';
    return { name: 'windows', version: v };
  }
  if (ua.includes('Mac OS X')) {
    const m = ua.match(/Mac OS X (\d+[._]\d+)/);
    return { name: 'macos', version: m ? `macOS ${m[1].replace('_', '.')}` : 'macOS' };
  }
  if (ua.includes('Linux')) return { name: 'linux', version: 'Linux' };
  if (ua.includes('Android')) {
    const m = ua.match(/Android (\d+[.\d]*)/);
    return { name: 'android', version: m ? `Android ${m[1]}` : 'Android' };
  }
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    const m = ua.match(/OS (\d+[._]\d+)/);
    return { name: 'ios', version: m ? `iOS ${m[1].replace('_', '.')}` : 'iOS' };
  }
  return { name: 'unknown', version: 'Unknown' };
}

/** get the device name */
function detectDeviceName(): string {
  const platform = navigator.platform || '';
  if (platform.includes('Win')) return 'Windows PC';
  if (platform.includes('Mac')) return 'Mac';
  if (platform.includes('Linux')) return 'Linux PC';
  return platform || 'Unknown Device';
}

/** current client platform name（windows / macos / linux / ...），for version-check and other APIs */
export function getPlatformName(): string {
  return detectOS().name;
}

/** assemble device info needed for login */
export async function getDeviceInfo() {
  const os = detectOS();
  return {
    deviceCode: await getDeviceCode(),
    deviceName: detectDeviceName(),
    deviceType: os.name,
    osVersion: os.version,
    appVersion: APP_VERSION,
  };
}

/** check if currently a desktop app env（for deviceType check） */
export { isDesktop };