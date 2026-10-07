import type { Locale } from 'antd/es/locale';

export interface LanguageDef {
  code: string;
  /** language name in its own language */
  label: string;
  /** built-in antd locale, lazy loaded (imported packs fall back to en_US) */
  antdLocale: () => Promise<{ default: Locale }>;
  /** all translation resources for this language, keyed by namespace */
  loadResources: () => Promise<Record<string, object>> | Record<string, object>;
  /** imported from an external language pack */
  imported?: boolean;
}

export const BUILTIN_LANGUAGES: LanguageDef[] = [
  {
    code: 'zh-CN',
    label: '简体中文',
    antdLocale: () => import('antd/locale/zh_CN'),
    loadResources: () => import('./locales/zh-CN/index'),
  },
  {
    code: 'en-US',
    label: 'English',
    antdLocale: () => import('antd/locale/en_US'),
    loadResources: () => import('./locales/en-US/index'),
  },
];

// runtime language list, can grow via language pack imports in Settings
export const LANGUAGES: LanguageDef[] = [...BUILTIN_LANGUAGES];

export const DEFAULT_LANG = 'zh-CN';
export const FALLBACK_LANG = 'en-US';

/**
 * import an external language pack (JSON).
 * shape: { "code": "ja-JP", "label": "日本語", "resources": { "common": { ... } } }
 * or flat: { "code": "ja-JP", "label": "日本語", "common": { ... } }
 */
export function addImportedLanguage(
  code: string,
  label: string,
  resources: Record<string, object>
): LanguageDef {
  // drop an existing language with the same code
  const idx = LANGUAGES.findIndex((l) => l.code === code);
  if (idx >= 0) LANGUAGES.splice(idx, 1);

  const def: LanguageDef = {
    code,
    label,
    antdLocale: () => import('antd/locale/en_US'),
    loadResources: () => resources,
    imported: true,
  };
  LANGUAGES.push(def);
  return def;
}

/** restore imported language packs from localStorage */
const STORAGE_KEY = 'ilinkcat_custom_languages';

export function saveCustomLanguages() {
  try {
    const imported = LANGUAGES.filter((l) => l.imported);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported.map((l) => ({
      code: l.code,
      label: l.label,
      resources: (l.loadResources as () => Record<string, object>)(),
    }))));
  } catch { /* ignore */ }
}

export function restoreCustomLanguages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as { code: string; label: string; resources: Record<string, object> }[];
    for (const item of list) {
      addImportedLanguage(item.code, item.label, item.resources);
    }
  } catch { /* ignore */ }
}