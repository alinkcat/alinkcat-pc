import type { Locale } from 'antd/es/locale';

export interface LanguageDef {
  code: string;
  /** 用母语显示的语言名 */
  label: string;
  /** antd 内置语言包，懒加载 */
  antdLocale: () => Promise<{ default: Locale }>;
  /** 该语言的全部翻译资源，按 namespace 聚合 */
  loadResources: () => Promise<Record<string, object>>;
}

export const LANGUAGES: LanguageDef[] = [
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

export const DEFAULT_LANG = 'zh-CN';