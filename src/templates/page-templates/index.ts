import type { EditorPage } from '../../pages/Editor/types';

export interface PageTemplateDef {
  id: string;
  label: string;
  description: string;
  category: string;
  /** deep-copied before use */
  page: EditorPage;
}

export const PAGE_TEMPLATES: PageTemplateDef[] = [
  {
    id: 'page-empty-grid',
    label: '空白网格页',
    description: '4x6 网格布局，从零开始',
    category: 'blank',
    page: {
      id: '',
      label: '新页面',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#ffffff',
      widgets: [],
    },
  },
  {
    id: 'page-empty-free',
    label: '空白自由页',
    description: '自由布局，任意放置组件',
    category: 'blank',
    page: {
      id: '',
      label: '新页面',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#ffffff',
      widgets: [],
    },
  },
  {
    id: 'page-monitor',
    label: '系统监控页',
    description: 'CPU/内存/磁盘/网络监控',
    category: 'monitor',
    page: {
      id: '',
      label: '监控',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0a0e1a',
      widgets: [
        { id: '', type: 'system-monitor', label: 'CPU', gridCol: 0, gridRow: 0, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8, showCPU: true, showMemory: false, showDisk: false, showNetwork: false, refreshInterval: 2 },
        { id: '', type: 'system-monitor', label: '内存', gridCol: 2, gridRow: 0, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8, showCPU: false, showMemory: true, showDisk: false, showNetwork: false, refreshInterval: 2 },
        { id: '', type: 'system-monitor', label: '磁盘', gridCol: 0, gridRow: 2, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8, showCPU: false, showMemory: false, showDisk: true, showNetwork: false, refreshInterval: 5 },
        { id: '', type: 'system-monitor', label: '网络', gridCol: 2, gridRow: 2, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8, showCPU: false, showMemory: false, showDisk: false, showNetwork: true, refreshInterval: 2 },
        { id: '', type: 'clock', label: '时钟', gridCol: 0, gridRow: 4, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 14, fontWeight: 'bold', borderRadius: 8, format24h: true, showSeconds: true, showAmpm: false },
        { id: '', type: 'gauge', label: 'CPU 温度', gridCol: 2, gridRow: 4, gridW: 2, gridH: 2, backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8, dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100, ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3 },
      ],
    },
  },
  {
    id: 'page-clock',
    label: '时钟日期页',
    description: '大字体时钟 + 日期，横屏适配',
    category: 'clock',
    page: {
      id: '',
      label: '时钟',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a1a2e',
      widgets: [
        { id: '', type: 'clock', label: '时钟', gridCol: 0, gridRow: 0, gridW: 4, gridH: 3, freeX: 5, freeY: 5, freeW: 90, freeH: 35, backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ffffff', fontSize: 36, fontWeight: 'bolder', borderRadius: 0, format24h: true, showSeconds: true, showAmpm: false },
        { id: '', type: 'date', label: '日期', gridCol: 0, gridRow: 3, gridW: 2, gridH: 1, freeX: 5, freeY: 42, freeW: 90, freeH: 10, backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#a0a0c0', fontSize: 16, fontWeight: 'normal', borderRadius: 0, dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true },
        { id: '', type: 'snippet-list', label: '便签', gridCol: 0, gridRow: 4, gridW: 4, gridH: 2, freeX: 5, freeY: 55, freeW: 90, freeH: 40, backgroundColor: '#16213e', backgroundOpacity: 100, textColor: '#e0e0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 8, snippets: [{ id: 's1', label: '事项', content: '双击编辑' }], mode: 'note' },
      ],
    },
  },
  {
    id: 'page-media',
    label: '媒体控制页',
    description: '音乐控制 + 播放进度',
    category: 'media',
    page: {
      id: '',
      label: '媒体',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#2d0a31',
      widgets: [
        { id: '', type: 'media-control', label: '音乐控制', gridCol: 0, gridRow: 0, gridW: 4, gridH: 3, backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8, displayMode: 'always', showCover: true, showProgress: true },
        { id: '', type: 'clock', label: '时钟', gridCol: 0, gridRow: 3, gridW: 2, gridH: 2, backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#e8b4f8', fontSize: 16, fontWeight: 'bold', borderRadius: 8, format24h: true, showSeconds: false, showAmpm: false },
        { id: '', type: 'date', label: '日期', gridCol: 0, gridRow: 5, gridW: 2, gridH: 1, backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#c084d0', fontSize: 10, fontWeight: 'normal', borderRadius: 8, dateFormat: 'YYYY年MM月DD日', showLunar: false },
        { id: '', type: 'launcher', label: '启动', gridCol: 2, gridRow: 3, gridW: 2, gridH: 3, backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8, name: 'QQ 音乐', path: 'qqmusic', icon: '🎵' },
      ],
    },
  },
  {
    id: 'page-cyberpunk',
    label: '赛博朋克监控',
    description: '霓虹配色 + 监控仪表盘',
    category: 'monitor',
    page: {
      id: '',
      label: '监控',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#0d0221',
      widgets: [
        { id: '', type: 'text', label: '标题', gridCol: 0, gridRow: 0, gridW: 4, gridH: 1, freeX: 5, freeY: 3, freeW: 90, freeH: 10, backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ff00ff', fontSize: 18, fontWeight: 'bold', borderRadius: 0, content: '⚡ SYSTEM MONITOR', textAlign: 'center' },
        { id: '', type: 'gauge', label: 'CPU', gridCol: 0, gridRow: 1, gridW: 2, gridH: 2, freeX: 5, freeY: 18, freeW: 42, freeH: 32, backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'bold', borderRadius: 4, dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100, ringColorLow: '#00ffff', ringColorMid: '#ff00ff', ringColorHigh: '#ff0055', ringWidth: 4 },
        { id: '', type: 'gauge', label: '内存', gridCol: 2, gridRow: 1, gridW: 2, gridH: 2, freeX: 53, freeY: 18, freeW: 42, freeH: 32, backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'bold', borderRadius: 4, dataSource: 'system.memory.usage', unit: '%', gaugeStyle: 'number', minValue: 0, maxValue: 100, ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3 },
        { id: '', type: 'clock', label: '时钟', gridCol: 0, gridRow: 3, gridW: 2, gridH: 1, freeX: 5, freeY: 55, freeW: 42, freeH: 18, backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#ff00ff', fontSize: 14, fontWeight: 'bold', borderRadius: 4, format24h: true, showSeconds: true, showAmpm: false },
        { id: '', type: 'date', label: '日期', gridCol: 0, gridRow: 4, gridW: 2, gridH: 1, freeX: 5, freeY: 75, freeW: 42, freeH: 10, backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#8844ff', fontSize: 10, fontWeight: 'normal', borderRadius: 4, dateFormat: 'YYYY/MM/DD', showLunar: false },
        { id: '', type: 'system-monitor', label: '网络', gridCol: 2, gridRow: 3, gridW: 2, gridH: 3, freeX: 53, freeY: 55, freeW: 42, freeH: 40, backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'normal', borderRadius: 4, showCPU: false, showMemory: false, showDisk: false, showNetwork: true, refreshInterval: 2 },
      ],
    },
  },
  {
    id: 'page-weather',
    label: '天气页',
    description: '天气信息 + 快速操作',
    category: 'weather',
    page: {
      id: '',
      label: '天气',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0f2027',
      widgets: [
        { id: '', type: 'clock', label: '时钟', gridCol: 0, gridRow: 0, gridW: 4, gridH: 2, backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 18, fontWeight: 'bold', borderRadius: 8, format24h: true, showSeconds: false, showAmpm: false },
        { id: '', type: 'date', label: '日期', gridCol: 0, gridRow: 2, gridW: 2, gridH: 1, backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#a0d0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 8, dateFormat: 'YYYY年MM月DD日', showLunar: false },
        { id: '', type: 'webview', label: '天气', gridCol: 2, gridRow: 2, gridW: 2, gridH: 1, backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8, displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800, titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '' },
        { id: '', type: 'quick-action', label: '快捷面板', gridCol: 0, gridRow: 3, gridW: 4, gridH: 3, backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8, columns: 2, rows: 2, cells: [{ type: 'launcher', name: '计算器', path: 'calc' }, { type: 'launcher', name: '记事本', path: 'notepad' }, { type: 'snippet', title: '欢迎语', snippets: [{ id: 's1', label: '您好', content: '您好！' }] }, { type: 'snippet', title: '结束语', snippets: [{ id: 's2', label: '感谢', content: '谢谢！' }] }] },
      ],
    },
  },
];

/**
 * Deep-copy page templates
 */
export function clonePageTemplate(page: EditorPage): EditorPage {
  return JSON.parse(JSON.stringify(page)) as EditorPage;
}