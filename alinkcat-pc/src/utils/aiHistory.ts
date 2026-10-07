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

// load chat history for a theme pack
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

// autosaves every 30 messages, can also be called manually
export function saveHistory(themeId: string, messages: AIMessage[]): void {
  if (messages.length % SAVE_EVERY !== 0 && messages.length > SAVE_EVERY) {
    // only persist on multiples of 30 to avoid frequent writes
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

// force save, used on clear / theme pack switch / shutdown
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

// export history as a downloaded json file
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
