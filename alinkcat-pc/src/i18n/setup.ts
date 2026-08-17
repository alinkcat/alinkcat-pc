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

// 启动时恢复外部导入的语言包
restoreCustomLanguages();

// 同步加载兜底英语资源（fallbackLng = en-US）
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
});

export async function setAppLanguage(code: string) {
  const def = LANGUAGES.find((l) => l.code === code);
  if (!def) return;

  saveStoredLang(code);
  saveCustomLanguages();

  // 动态 import() 返回的是模块命名空间对象 { default: {...} }，需要解包
  const maybeMod = await def.loadResources();
  const resources = 'default' in (maybeMod as object)
    ? (maybeMod as { default: Record<string, object> }).default
    : (maybeMod as Record<string, object>);

  // 替换整个 common 命名空间
  i18n.addResourceBundle(code, 'common', resources, true, true);
  await i18n.changeLanguage(code);
}

export default i18n;