import { APP_VERSION } from '../config';
import { tauriInvoke } from './tauri';

const DEVICE_CODE_KEY = 'ilinkcat_device_code';

/** 生成 UUID v4 */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 获取设备唯一标识码（优先 Rust 磁盘持久化，回退 localStorage） */
export async function getDeviceCode(): Promise<string> {
  try {
    return await tauriInvoke<string>('get_device_code');
  } catch { /* 非 Tauri 环境 */ }
  let code = localStorage.getItem(DEVICE_CODE_KEY);
  if (!code) {
    code = generateUUID();
    localStorage.setItem(DEVICE_CODE_KEY, code);
  }
  return code;
}

/** 判断是否为 Tauri 桌面环境 */
function isDesktop(): boolean {
  try { return '__TAURI_INTERNALS__' in window; } catch { return false; }
}

/** 解析操作系统名称与版本 */
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

/** 获取设备名称 */
function detectDeviceName(): string {
  const platform = navigator.platform || '';
  if (platform.includes('Win')) return 'Windows PC';
  if (platform.includes('Mac')) return 'Mac';
  if (platform.includes('Linux')) return 'Linux PC';
  return platform || 'Unknown Device';
}

/** 组装登录所需的设备信息 */
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

/** 判断当前是否为桌面应用环境（用于 deviceType 判断） */
export { isDesktop };