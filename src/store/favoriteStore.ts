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
    // optimistic update
    const next = isFav ? list.filter((id) => id !== themeId) : [...list, themeId];
    saveLocal(next);
    set({ favorites: next });
    // sync to backend (POST toggle: unfavorite if favorited, favorite if not)
    try {
      await themeApi.favorite(themeId);
      return !isFav;
    } catch {
      // rollback
      saveLocal(list);
      set({ favorites: list });
      return isFav;
    }
  },

  isFavorite: (themeId) => get().favorites.includes(themeId),

  hydrate: async () => {
    // fetch favorites from backend
    try {
      const resp = await themeApi.favorites({ page: 1, size: 100 });
      if (resp.code === 200 && resp.data) {
        const ids = resp.data.records.map((t) => t.themeId);
        saveLocal(ids);
        set({ favorites: ids });
      }
    } catch { /* keep local copy when not logged in or on failure */ }
  },
}));