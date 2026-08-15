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

/** 加载主题包的对话历史 */
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

/** 保存对话历史（每 30 条自动保存，也可手动调用） */
export function saveHistory(themeId: string, messages: AIMessage[]): void {
  if (messages.length % SAVE_EVERY !== 0 && messages.length > SAVE_EVERY) {
    // 仅当达到 30 的倍数或强制保存时落盘，避免频繁写入
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
    // localStorage 可能满，忽略
  }
}

/** 强制保存（清空、切换主题包、关闭时调用） */
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

/** 导出历史为 JSON 并下载 */
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
