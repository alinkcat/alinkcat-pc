import { create } from 'zustand';
import { LANGUAGES, FALLBACK_LANG, addImportedLanguage, saveCustomLanguages } from './languages';
import { loadStoredLang, setAppLanguage } from './setup';
import type { Locale } from 'antd/es/locale';

interface I18nState {
  lang: string;
  antdLocale: Locale | null;
  initialized: boolean;
  /** 当前可用语言列表（含外部导入） */
  languages: { code: string; label: string }[];
  changeLang: (code: string) => Promise<void>;
  /** 导入外部语言包 JSON */
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

    // 加载 antd locale
    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    // 切换 i18next
    await setAppLanguage(code);

    set({ lang: code, antdLocale });
  },

  importLanguage: async (payload) => {
    const def = addImportedLanguage(payload.code, payload.label, payload.resources);
    saveCustomLanguages();
    set({ languages: LANGUAGES.map((l) => ({ code: l.code, label: l.label })) });
    // 导入后自动切换到新语言
    await get().changeLang(def.code);
  },

  hydrate: async () => {
    const saved = loadStoredLang();
    const def = LANGUAGES.find((l) => l.code === saved) || LANGUAGES[0];

    // 确保 i18next 语言与资源已就绪
    await setAppLanguage(saved).catch(console.error);

    const antdModule = await def.antdLocale();
    const antdLocale = antdModule.default || antdModule;

    set({ lang: saved, antdLocale, initialized: true });
  },
}));