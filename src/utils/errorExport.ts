import { getLogs, type LogEntry } from './logger';
import { APP_VERSION } from '../config';

/** derived password for the encryption key（fixed value + version number，used only for diagnostic log encryption） */
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

/** build a diagnostic data packet */
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
 * export an encrypted diagnostic log file。
 * encrypted with AES-256-GCM，key derived from APP_VERSION。
 * user clicks"export logs"button to invoke，opens a system save dialog to pick a path。
 */
export async function exportEncryptedLogs(): Promise<void> {
  const logs = getLogs();
  if (logs.length === 0) {
    throw new Error('no logs to export');
  }

  const data = buildDiagnosticData(logs);
  const json = JSON.stringify(data, null, 2);
  const plaintext = new TextEncoder().encode(json);

  // generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(APP_VERSION);

  // encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  // pack into { iv, data } structure; front-end base64-encodes and saves。
  // note: do not use btoa(String.fromCharCode(...combined)) — large payloads trigger
  // "Maximum call stack size exceeded"(spread args hit the call-stack limit). Encode in chunks instead.
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  let base64 = '';
  const CHUNK = 0x8000; // 32768, avoids the spread-arg stack-depth limit
  for (let i = 0; i < combined.length; i += CHUNK) {
    base64 += btoa(String.fromCharCode(...combined.subarray(i, i + CHUNK)));
  }
  const blobStr = JSON.stringify({ v: 1, alg: 'AES-256-GCM', key: 'app-version', data: base64 }, null, 2);
  const defaultName = `ilinkcat-diag-${new Date().toISOString().slice(0, 10)}.json`;

  // in Tauri env, prefer the native save dialog
  const { isTauri, tauriInvoke } = await import('../utils/tauri');
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Diagnostic Log', extensions: ['json'] }],
      });
      if (!path) return; // user cancelled
      // write file via Rust backend, no front-end fs plugin needed
      await tauriInvoke('save_text_file', { path, content: blobStr });
      return;
    } catch {
      // fall back to browser download
    }
  }

  // browser download (fallback)
  const blob = new Blob([blobStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * decrypt a diagnostic log file（for developer use）。
 * pass base64-encoded encrypted data，returns the original JSON。
 */
export async function decryptLogs(encryptedJson: string): Promise<Record<string, unknown>> {
  const { v, data } = JSON.parse(encryptedJson) as { v: number; data: string };
  if (v !== 1) throw new Error('unsupported version');

  const combined = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const key = await getKey(APP_VERSION);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}