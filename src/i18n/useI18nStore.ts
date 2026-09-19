import { create } from 'zustand';
import { LANGUAGES, FALLBACK_LANG, addImportedLanguage, saveCustomLanguages } from './languages';
import { loadStoredLang, setAppLanguage } from './setup';
import type { Locale } from 'antd/es/locale';

interface I18nState {
  lang: string;
  antdLocale: Locale | null;
  initialized: boolean;
  /** currently available language list（including imported） */
  languages: { code: string; label: string }[];
  changeLang: (code: string) => Promise<void>;
  /** import an external language pack JSON */
  importLanguage: (payload: { code: string; label: string; resources: Record<string, object> }) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  lang: FALLBACK_LANG,
  antdLocale: null,
  initialized: false,
  languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })),

  changeLang: async (code: string) => {
    const def = LANGUAGES.find((l) => l.code === code);
    if (!def) return;

    // load antd locale
    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    // switch i18next
    await setAppLanguage(code);

    set({ lang: code, antdLocale });
  },

  importLanguage: async (payload) => {
    const def = addImportedLanguage(payload.code, payload.label, payload.resources);
    saveCustomLanguages();
    set({ languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })) });
    // auto-switch to the new language after import
    await get().changeLang(def.code);
  },

  hydrate: async () => {
    const saved = loadStoredLang();
    const def = LANGUAGES.find((l) => l.code === saved) || LANGUAGES[0];

    // ensure i18next language and resources are ready
    await setAppLanguage(saved).catch(console.error);

    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    set({ lang: saved, antdLocale, initialized: true });
  },
}));