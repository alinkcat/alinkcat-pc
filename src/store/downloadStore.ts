import { create } from 'zustand';
import { Modal } from 'antd';
import { i18n } from '../i18n';
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

/** 从错误消息中解析已存在的主题 ID，如 "Theme 'xxx' already exists" */
function parseExistingThemeId(err: string): string | null {
  const match = err.match(/Theme '([^']+)' already exists/);
  return match ? match[1] : null;
}

/** 若目标主题已存在则弹覆盖确认，确认后删除旧包再导入。返回是否真正导入成功。 */
async function importThemeFileWithOverwrite(filePath: string): Promise<boolean> {
  try {
    await tauriInvoke('import_theme_from_file', { path: filePath });
    return true;
  } catch (e) {
    const err = String(e);
    if (!err.includes('already exists') && !err.includes('已存在')) throw e;
    const themeId = parseExistingThemeId(err);
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: i18n.t('themes.confirmOverwriteTitle') || 'Overwrite Theme?',
        content: themeId
          ? i18n.t('themes.confirmOverwriteContent', { name: themeId })
          : 'A theme with the same ID already exists. Overwrite?',
        okText: i18n.t('themes.confirmOverwrite') || 'Overwrite',
        okType: 'danger',
        cancelText: i18n.t('common.cancel') || 'Cancel',
        onOk: async () => {
          if (themeId) await tauriInvoke('delete_theme', { id: themeId });
          await tauriInvoke('import_theme_from_file', { path: filePath });
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });
  }
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
      const ok = await importThemeFileWithOverwrite(item.filePath);
      if (ok) get().remove(themeId);
    } finally {
      set({ importing: false });
    }
  },

  importAll: async () => {
    set({ importing: true });
    try {
      const snapshot = [...get().queue];
      const failedItems: PendingDownload[] = [];
      for (const item of snapshot) {
        try {
          const ok = await importThemeFileWithOverwrite(item.filePath);
          if (!ok) failedItems.push(item);
        } catch (e) {
          failedItems.push(item);
        }
      }
      if (failedItems.length === 0) {
        save([]);
        set({ queue: [] });
      } else {
        // 保留失败的项，移除已成功的项
        const failedIds = new Set(failedItems.map((i) => i.id));
        const rest = get().queue.filter((q) => !failedIds.has(q.id));
        save(rest);
        set({ queue: rest });
      }
    } finally {
      set({ importing: false });
    }
  },

  clear: () => {
    save([]);
    set({ queue: [] });
  },
}));