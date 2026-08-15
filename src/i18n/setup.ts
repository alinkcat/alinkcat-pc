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

// 同步加载兜底中文资源
import zhCommon from './locales/zh-CN/common.json';
import zhLayout from './locales/zh-CN/layout.json';
import zhSettings from './locales/zh-CN/settings.json';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      common: zhCommon,
      layout: zhLayout,
      settings: zhSettings,
    },
  },
  lng: loadStoredLang(),
  fallbackLng: 'zh-CN',
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

  // 非中文语言懒加载
  if (!i18n.hasResourceBundle(code, 'common')) {
    const resources = (await def.loadResources()) as Record<string, object>;
    Object.entries(resources).forEach(([ns, bundle]) => {
      i18n.addResourceBundle(code, ns, bundle, true, true);
    });
  }

  await i18n.changeLanguage(code);
}

export default i18n;