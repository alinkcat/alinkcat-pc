import { create } from 'zustand';
import { themeApi } from '../api/themeApi';

const STORAGE_KEY = 'ilinkcat_favorites';

function loadLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

interface FavoriteState {
  favorites: string[];
  loading: boolean;
  toggle: (themeId: string) => Promise<boolean>;
  isFavorite: (themeId: string) => boolean;
  hydrate: () => Promise<void>;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: loadLocal(),
  loading: false,

  toggle: async (themeId) => {
    const list = get().favorites;
    const isFav = list.includes(themeId);
    // 乐观更新
    const next = isFav ? list.filter((id) => id !== themeId) : [...list, themeId];
    saveLocal(next);
    set({ favorites: next });
    // 同步后端（POST 切换：已收藏则取消，未收藏则添加）
    try {
      await themeApi.favorite(themeId);
      return !isFav;
    } catch {
      // 回滚
      saveLocal(list);
      set({ favorites: list });
      return isFav;
    }
  },

  isFavorite: (themeId) => get().favorites.includes(themeId),

  hydrate: async () => {
    // 从后端拉取收藏列表
    try {
      const resp = await themeApi.favorites({ page: 1, size: 100 });
      if (resp.code === 200 && resp.data) {
        const ids = resp.data.records.map((t) => t.themeId);
        saveLocal(ids);
        set({ favorites: ids });
      }
    } catch { /* 未登录或失败时保留本地 */ }
  },
}));