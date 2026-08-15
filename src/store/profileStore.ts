import { create } from 'zustand';
import type { UserProfile } from '../types/profile';
import { DEFAULT_PROFILE } from '../types/profile';

const STORAGE_KEY = 'ilinkcat_profile';

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PROFILE;
}

interface ProfileState {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  toggleFavorite: (themeId: string) => void;
  isFavorite: (themeId: string) => boolean;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: loadProfile(),

  updateProfile: (updates) => {
    set((s) => {
      const profile = { ...s.profile, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return { profile };
    });
  },

  toggleFavorite: (themeId) => {
    const favs = get().profile.favorites;
    const next = favs.includes(themeId)
      ? favs.filter((f) => f !== themeId)
      : [...favs, themeId];
    get().updateProfile({ favorites: next, favoriteCount: next.length });
  },

  isFavorite: (themeId) => get().profile.favorites.includes(themeId),
}));
