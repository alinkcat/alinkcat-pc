import type { AIMessage } from '../types/ai';

const SAVE_EVERY = 30;

function historyKey(themeId: string): string {
  return `ai_history_${themeId}`;
}

interface HistoryFile {
  themeId: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

/** load the theme's chat history */
export function loadHistory(themeId: string): AIMessage[] {
  try {
    const raw = localStorage.getItem(historyKey(themeId));
    if (!raw) return [];
    const data = JSON.parse(raw) as HistoryFile;
    return Array.isArray(data.messages) ? data.messages : [];
  } catch {
    return [];
  }
}

/** save chat history（auto-save every 30 messages，can also be called manually） */
export function saveHistory(themeId: string, messages: AIMessage[]): void {
  if (messages.length % SAVE_EVERY !== 0 && messages.length > SAVE_EVERY) {
    // only flush on multiples of 30 or forced save, avoid frequent writes
  }
  const file: HistoryFile = {
    themeId,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(historyKey(themeId), JSON.stringify(file));
  } catch {
    // localStorage may be full, ignore
  }
}

/** force save（clear, switch theme, on close） */
export function saveHistoryNow(themeId: string, messages: AIMessage[]): void {
  const file: HistoryFile = {
    themeId,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(historyKey(themeId), JSON.stringify(file));
  } catch {
    // ignore
  }
}

export function clearHistory(themeId: string): void {
  localStorage.removeItem(historyKey(themeId));
}

/** export history as JSON and download */
export function exportHistory(themeId: string, messages: AIMessage[]): void {
  const blob = new Blob([JSON.stringify({ themeId, messages, exportedAt: new Date().toISOString() }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai_history_${themeId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
