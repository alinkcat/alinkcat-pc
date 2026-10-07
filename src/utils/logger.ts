/** error log entry */
export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  source?: string;
}

const MAX_LOGS = 200;
let logs: LogEntry[] = [];
let nextId = 0;
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let initialized = false;

function addLog(level: LogEntry['level'], message: string, stack?: string, source?: string) {
  logs.push({ id: nextId++, timestamp: new Date().toISOString(), level, message, stack, source });
  if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
}

/** initialize error capture（intercept console.error + global errors） */
export function initLogger() {
  if (initialized) return;
  initialized = true;

  originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'object' ? safeStringify(a) : String(a))).join(' ');
    addLog('error', msg, new Error().stack, 'console.error');
    originalConsoleError?.apply(console, args);
  };

  originalConsoleWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'object' ? safeStringify(a) : String(a))).join(' ');
    addLog('warn', msg, undefined, 'console.warn');
    originalConsoleWarn?.apply(console, args);
  };

  window.addEventListener('error', (e) => {
    addLog('error', e.message || String(e.error), e.error?.stack, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason);
    addLog('error', msg, e.reason?.stack, 'unhandledrejection');
  });
}

function safeStringify(obj: unknown): string {
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

/** get all logs */
export function getLogs(): LogEntry[] {
  return [...logs];
}

/** clear logs */
export function clearLogs() {
  logs = [];
  nextId = 0;
}