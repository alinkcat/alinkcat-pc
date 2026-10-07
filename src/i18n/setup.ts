import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES, FALLBACK_LANG, restoreCustomLanguages, saveCustomLanguages } from './languages';

const STORAGE_KEY = 'ilinkcat_language';

export function loadStoredLang(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved!;
  } catch {
    /* ignore */
  }
  return FALLBACK_LANG;
}

export function saveStoredLang(code: string) {
  localStorage.setItem(STORAGE_KEY, code);
}

// restore imported language packs on startup
restoreCustomLanguages();

// synchronously load fallback English resources（fallbackLng = en-US）
import enResources from './locales/en-US/index';

i18n.use(initReactI18next).init({
  resources: {
    'en-US': {
      common: enResources,
    },
  },
  lng: loadStoredLang(),
  fallbackLng: FALLBACK_LANG,
  defaultNS: 'common',
  ns: ['common'],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  returnEmptyString: false,
  returnObjects: true,
});

export async function setAppLanguage(code: string) {
  const def = LANGUAGES.find((l) => l.code === code);
  if (!def) return;

  saveStoredLang(code);
  saveCustomLanguages();

  // dynamic import() returns a module namespace object { default: {...} }，needs unwrapping
  const maybeMod = await def.loadResources();
  const resources = 'default' in (maybeMod as object)
    ? (maybeMod as { default: Record<string, object> }).default
    : (maybeMod as Record<string, object>);

  // replace the entire common namespace
  i18n.addResourceBundle(code, 'common', resources, true, true);
  await i18n.changeLanguage(code);
}

export default i18n;