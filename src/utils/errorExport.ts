import { getLogs, type LogEntry } from './logger';
import { APP_VERSION } from '../config';

/** 加密密钥的派生密码（固定值 + 版本号，仅用于诊断日志加密） */
function deriveKey(): { salt: Uint8Array; iterations: number } {
  return { salt: new TextEncoder().encode('ilinkcat-diag-salt'), iterations: 100000 };
}

async function getKey(passphrase: string): Promise<CryptoKey> {
  const { salt, iterations } = deriveKey();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt'],
  );
}

/** 构建诊断数据包 */
function buildDiagnosticData(logs: LogEntry[]): Record<string, unknown> {
  return {
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    platform: navigator.platform || 'unknown',
    userAgent: navigator.userAgent?.slice(0, 100),
    logs,
  };
}

/**
 * 导出加密的诊断日志文件。
 * 使用 AES-256-GCM 加密，密钥从 APP_VERSION 派生。
 * 用户通过"导出日志"按钮调用，弹出系统保存对话框选择路径。
 */
export async function exportEncryptedLogs(): Promise<void> {
  const logs = getLogs();
  if (logs.length === 0) {
    throw new Error('暂无日志可导出');
  }

  const data = buildDiagnosticData(logs);
  const json = JSON.stringify(data, null, 2);
  const plaintext = new TextEncoder().encode(json);

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(APP_VERSION);

  // 加密
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  // 打包为 { iv, data } 结构，前端 base64 编码后保存
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  const base64 = btoa(String.fromCharCode(...combined));
  const blobStr = JSON.stringify({ v: 1, alg: 'AES-256-GCM', key: 'app-version', data: base64 }, null, 2);
  const defaultName = `ilinkcat-diag-${new Date().toISOString().slice(0, 10)}.json`;

  // 在 Tauri 环境优先使用原生保存对话框选择路径
  const { isTauri } = await import('../utils/tauri');
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Diagnostic Log', extensions: ['json'] }],
      });
      if (!path) return; // 用户取消
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      // 某些环境下需要用 BaseDirectory 处理
      await writeTextFile(path, blobStr);
      return;
    } catch {
      // 降级到浏览器下载
    }
  }

  // 浏览器下载（兜底）
  const blob = new Blob([blobStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 解密诊断日志文件（供开发者使用）。
 * 传入 base64 编码的加密数据，返回原始 JSON。
 */
export async function decryptLogs(encryptedJson: string): Promise<Record<string, unknown>> {
  const { v, data } = JSON.parse(encryptedJson) as { v: number; data: string };
  if (v !== 1) throw new Error('不支持的版本');

  const combined = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const key = await getKey(APP_VERSION);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}