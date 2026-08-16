import type { EditorTheme } from '../pages/Editor/types';
import monitor from './monitor';
import clock from './clock';
import weather from './weather';
import cyberpunk from './cyberpunk';
import media from './media';
import blank from './blank';
import minimalistWhite from './minimalist-white';
import darkMode from './dark-mode';
import gaming from './gaming';
import business from './business';
import nature from './nature';
import minimalTime from './minimal-time';
import fullFeatured from './full-featured';
import liveWeather from './live-weather';
import musicWall from './music-wall';
import workspace from './workspace';
import pinkCute from './pink-cute';
import transparentAcrylic from './transparent-acrylic';
import retro from './retro';
import outdoorSports from './outdoor-sports';

export interface TemplateDef {
  /** 模板 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 分类：监控/时钟/媒体/空白/商务/游戏/自然等 */
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
  {
    id: 'template-minimalist-white',
    name: '简约白色',
    description: '纯白背景，简洁时钟+日期+便签，适合日常使用',
    category: 'minimal',
    theme: minimalistWhite,
  },
  {
    id: 'template-dark-mode',
    name: '深色模式',
    description: '深灰背景，暗色风格，适合夜间使用',
    category: 'dark',
    theme: darkMode,
  },
  {
    id: 'template-gaming',
    name: '游戏风格',
    description: '游戏主题配色，RGB 灯效风格，按钮+监控+时钟',
    category: 'gaming',
    theme: gaming,
  },
  {
    id: 'template-business',
    name: '商务风',
    description: '蓝色系，简洁大方，时钟+日程+天气，适合办公场景',
    category: 'business',
    theme: business,
  },
  {
    id: 'template-nature',
    name: '自然风光',
    description: '渐变绿色，时钟+日期+天气，清新自然风格',
    category: 'nature',
    theme: nature,
  },
  {
    id: 'template-minimal-time',
    name: '极简时间',
    description: '超大字体的时钟，只有时间+日期，极简 free 布局',
    category: 'clock',
    theme: minimalTime,
  },
  {
    id: 'template-full-featured',
    name: '全功能',
    description: '4 页主题：监控/媒体/时钟/快捷面板，grid 布局',
    category: 'allround',
    theme: fullFeatured,
  },
  {
    id: 'template-live-weather',
    name: '实时天气',
    description: '天气主页+时钟+日期+快捷面板，天气配色',
    category: 'weather',
    theme: liveWeather,
  },
  {
    id: 'template-music-wall',
    name: '音乐墙',
    description: '大封面音乐控制+歌词+时钟，深色风格',
    category: 'media',
    theme: musicWall,
  },
  {
    id: 'template-workspace',
    name: '工作台',
    description: '待办事项+时钟+日历+应用启动，适合办公场景',
    category: 'business',
    theme: workspace,
  },
  {
    id: 'template-pink-cute',
    name: '粉色可爱',
    description: '粉色主题，圆角组件，可爱风格，适合少女心用户',
    category: 'cute',
    theme: pinkCute,
  },
  {
    id: 'template-transparent-acrylic',
    name: '透明亚克力',
    description: '透明背景+毛玻璃效果，极简组件，现代感',
    category: 'minimal',
    theme: transparentAcrylic,
  },
  {
    id: 'template-retro',
    name: '复古怀旧',
    description: '暖色调，复古风格，时钟+日期+日历，怀旧体验',
    category: 'retro',
    theme: retro,
  },
  {
    id: 'template-outdoor-sports',
    name: '户外运动',
    description: '运动风格，健康数据+时钟+天气，适合户外爱好者',
    category: 'sports',
    theme: outdoorSports,
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