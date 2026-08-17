import type { Locale } from 'antd/es/locale';

export interface LanguageDef {
  code: string;
  /** 用母语显示的语言名 */
  label: string;
  /** antd 内置语言包，懒加载（外部导入语言包时返回 en_US 作为 fallback） */
  antdLocale: () => Promise<{ default: Locale }>;
  /** 该语言的全部翻译资源，按 namespace 聚合 */
  loadResources: () => Promise<Record<string, object>> | Record<string, object>;
  /** 是否为外部导入的语言包 */
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

// 运行时语言列表（可在设置页通过导入语言包动态扩展）
export const LANGUAGES: LanguageDef[] = [...BUILTIN_LANGUAGES];

export const DEFAULT_LANG = 'zh-CN';
export const FALLBACK_LANG = 'en-US';

/**
 * 导入外部语言包（JSON）。
 * 格式：{ "code": "ja-JP", "label": "日本語", "resources": { "common": { ... } } }
 * 或扁平格式：{ "code": "ja-JP", "label": "日本語", "common": { ... } }
 */
export function addImportedLanguage(
  code: string,
  label: string,
  resources: Record<string, object>
): LanguageDef {
  // 移除已存在的同名语言
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

/**
 * 从 localStorage 恢复外部导入的语言包。
 */
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