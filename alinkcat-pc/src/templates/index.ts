import type { EditorTheme } from '../pages/Editor/types';
import monitor from './monitor';
import clock from './clock';
import weather from './weather';
import cyberpunk from './cyberpunk';
import media from './media';
import blank from './blank';

export interface TemplateDef {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 分类：监控/时钟/媒体/空白 */
  category: string;
  /** 模板主题数据 */
  theme: EditorTheme;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'template-monitor',
    name: '系统监控',
    description: '实时监控 CPU、内存、磁盘、网络状态，横屏布局',
    category: 'monitor',
    theme: monitor,
  },
  {
    id: 'template-clock',
    name: '极简时钟',
    description: '大字体时钟搭配日期和便签，简约清晰，竖屏布局',
    category: 'clock',
    theme: clock,
  },
  {
    id: 'template-weather',
    name: '天气时钟',
    description: '显示时间、日期、天气信息，附带快捷面板',
    category: 'weather',
    theme: weather,
  },
  {
    id: 'template-cyberpunk',
    name: '赛博朋克监控',
    description: '赛博朋克风格，霓虹配色 + 系统监控，横屏布局',
    category: 'monitor',
    theme: cyberpunk,
  },
  {
    id: 'template-media',
    name: '媒体控制',
    description: '音乐控制面板，搭配时钟和应用启动器',
    category: 'media',
    theme: media,
  },
  {
    id: 'template-blank',
    name: '空白模板',
    description: '从零开始，自由创作',
    category: 'blank',
    theme: blank,
  },
];

/**
 * 通过模板 ID 查找模板数据
 */
export function getTemplateById(id: string): EditorTheme | undefined {
  return TEMPLATES.find((t) => t.id === id)?.theme;
}

/**
 * 深拷贝模板数据（避免共享引用导致状态串动）
 */
export function cloneTemplate(theme: EditorTheme): EditorTheme {
  return JSON.parse(JSON.stringify(theme)) as EditorTheme;
}