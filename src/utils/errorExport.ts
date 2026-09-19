import { getLogs, type LogEntry } from './logger';
import { APP_VERSION } from '../config';

/** scrub tokens, passwords, and emails from a string */
function redact(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(
      /["']?(token|accessToken|refreshToken|password|secret)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}["']?/gi,
      '$1: ***',
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***');
}

function buildDiagnosticData(logs: LogEntry[]): Record<string, unknown> {
  const safe = logs.map((l) => ({
    ...l,
    message: redact(l.message),
    stack: l.stack ? redact(l.stack) : undefined,
  }));

  return {
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    platform: navigator.platform || 'unknown',
    userAgent: navigator.userAgent?.slice(0, 100),
    logs: safe,
  };
}

/**
 * Export diagnostic logs as plain JSON.
 * Tokens and emails are stripped before writing.
 */
export async function exportLogs(): Promise<void> {
  const logs = getLogs();
  if (logs.length === 0) {
    throw new Error('no logs to export');
  }

  const json = JSON.stringify(buildDiagnosticData(logs), null, 2);
  const defaultName = `ailinkcat-diag-${new Date().toISOString().slice(0, 10)}.json`;

  const { isTauri, tauriInvoke } = await import('../utils/tauri');
  if (isTauri()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Diagnostic Log', extensions: ['json'] }],
      });
      if (!path) return;
      await tauriInvoke('save_text_file', { path, content: json });
      return;
    } catch {
      // fall back to browser download
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
}
