import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES, DEFAULT_LANG } from './languages';

const STORAGE_KEY = 'ilinkcat_language';

export function loadStoredLang(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === saved)) return saved!;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function saveStoredLang(code: string) {
  localStorage.setItem(STORAGE_KEY, code);
}

// 同步加载兜底中文资源（全部合入 common 命名空间）
import zhResources from './locales/zh-CN/index';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      common: zhResources,
    },
  },
  lng: loadStoredLang(),
  fallbackLng: 'zh-CN',
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

  const resources = (await def.loadResources()) as Record<string, object>;
  // 替换整个 common 命名空间
  i18n.addResourceBundle(code, 'common', resources, true, true);
  await i18n.changeLanguage(code);
}

export default i18n;