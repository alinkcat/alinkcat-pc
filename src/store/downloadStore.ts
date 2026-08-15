import { create } from 'zustand';
import { tauriInvoke } from '../utils/tauri';

const STORAGE_KEY = 'ilinkcat_download_queue';

export interface PendingDownload {
  id: string;
  themeId: string;
  name: string;
  version: string;
  author: string;
  filePath: string;
  downloadedAt: string;
}

function load(): PendingDownload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(list: PendingDownload[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface DownloadState {
  queue: PendingDownload[];
  importing: boolean;
  add: (item: PendingDownload) => void;
  remove: (themeId: string) => void;
  importTheme: (themeId: string) => Promise<void>;
  importAll: () => Promise<void>;
  clear: () => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  queue: load(),
  importing: false,

  add: (item) => {
    const list = get().queue.filter((q) => q.themeId !== item.themeId);
    list.push(item);
    save(list);
    set({ queue: list });
  },

  remove: (themeId) => {
    const list = get().queue.filter((q) => q.themeId !== themeId);
    save(list);
    set({ queue: list });
  },

  importTheme: async (themeId) => {
    const item = get().queue.find((q) => q.themeId === themeId);
    if (!item) throw new Error('未找到下载记录');
    set({ importing: true });
    try {
      await tauriInvoke('import_theme_from_file', { path: item.filePath });
      get().remove(themeId);
    } finally {
      set({ importing: false });
    }
  },

  importAll: async () => {
    set({ importing: true });
    try {
      for (const item of get().queue) {
        await tauriInvoke('import_theme_from_file', { path: item.filePath });
      }
      save([]);
      set({ queue: [] });
    } finally {
      set({ importing: false });
    }
  },

  clear: () => {
    save([]);
    set({ queue: [] });
  },
}));