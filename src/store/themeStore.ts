import { create } from 'zustand';

const STORAGE_KEY = 'ilinkcat_theme_mode';

type ThemeMode = 'light' | 'dark';

function loadMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  // Default to system preference
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  hydrate: () => void;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'light',
  isDark: false,

  hydrate: () => {
    const mode = loadMode();
    set({ mode, isDark: mode === 'dark' });
  },

  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    set({ mode, isDark: mode === 'dark' });
  },

  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    set({ mode: next, isDark: next === 'dark' });
  },
}));