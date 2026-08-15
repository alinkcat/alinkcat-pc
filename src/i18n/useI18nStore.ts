import { create } from 'zustand';
import { LANGUAGES, DEFAULT_LANG } from './languages';
import { loadStoredLang, setAppLanguage } from './setup';
import type { Locale } from 'antd/es/locale';

interface I18nState {
  lang: string;
  antdLocale: Locale | null;
  initialized: boolean;
  changeLang: (code: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  lang: DEFAULT_LANG,
  antdLocale: null,
  initialized: false,

  changeLang: async (code: string) => {
    const def = LANGUAGES.find((l) => l.code === code);
    if (!def) return;

    // 加载 antd locale
    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    // 切换 i18next
    await setAppLanguage(code);

    set({ lang: code, antdLocale });
  },

  hydrate: async () => {
    const saved = loadStoredLang();
    const def = LANGUAGES.find((l) => l.code === saved) || LANGUAGES[0];
    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    set({ lang: saved, antdLocale, initialized: true });
  },
}));