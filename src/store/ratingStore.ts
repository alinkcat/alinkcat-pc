import { create } from 'zustand';
import { themeApi } from '../api/themeApi';

const STORAGE_KEY = 'ilinkcat_user_ratings';

function loadLocal(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocal(map: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface RatingState {
  ratings: Record<string, number>;
  loading: boolean;
  setRating: (themeId: string, value: number) => Promise<void>;
  getRating: (themeId: string) => number;
}

export const useRatingStore = create<RatingState>((set, get) => ({
  ratings: loadLocal(),
  loading: false,

  setRating: async (themeId, value) => {
    // 乐观更新
    const map = { ...get().ratings };
    const prev = map[themeId] || 0;
    if (value > 0) {
      map[themeId] = value;
    } else {
      delete map[themeId];
    }
    saveLocal(map);
    set({ ratings: map });
    // 同步后端
    try {
      if (value > 0) {
        await themeApi.rate(themeId, value);
      }
    } catch {
      // 回滚
      if (prev > 0) {
        map[themeId] = prev;
      } else {
        delete map[themeId];
      }
      saveLocal(map);
      set({ ratings: map });
    }
  },

  getRating: (themeId) => get().ratings[themeId] || 0,
}));