import type { EditorTheme } from '../pages/Editor/types';

/**
 * Full-featured template - landscape
 * 4-page theme: monitor / media / clock / quick panel，grid layout
 */
const template: EditorTheme = {
  id: 'template-full-featured',
  name: '全功能',
  version: '1.0.0',
  author: '艾联猫',
  description: '4页主题：监控/媒体/时钟/快捷面板，grid布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '监控',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0a0e1a',
      widgets: [
        {
          id: 'w-cpu', type: 'system-monitor', label: 'CPU',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: true, showMemory: false, showDisk: false, showNetwork: false, refreshInterval: 2,
        },
        {
          id: 'w-mem', type: 'system-monitor', label: '内存',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: true, showDisk: false, showNetwork: false, refreshInterval: 2,
        },
        {
          id: 'w-disk', type: 'system-monitor', label: '磁盘',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: false, showDisk: true, showNetwork: false, refreshInterval: 5,
        },
        {
          id: 'w-net', type: 'system-monitor', label: '网络',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: false, showDisk: false, showNetwork: true, refreshInterval: 2,
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 4, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 16, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-gauge', type: 'gauge', label: 'CPU温度',
          gridCol: 2, gridRow: 4, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100,
          ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3,
        },
      ],
    },
    {
      id: 'p2',
      label: '媒体',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#2d0a31',
      widgets: [
        {
          id: 'w-media', type: 'media-control', label: '音乐控制',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 3,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          displayMode: 'always', showCover: true, showProgress: true,
        },
        {
          id: 'w-clock2', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 2,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#e8b4f8', fontSize: 16, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date2', type: 'date', label: '日期',
          gridCol: 0, gridRow: 5, gridW: 2, gridH: 1,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#c084d0', fontSize: 10, fontWeight: 'normal', borderRadius: 8,
          dateFormat: 'YYYY年MM月DD日', showLunar: false,
        },
        {
          id: 'w-launcher2', type: 'launcher', label: '音乐',
          gridCol: 2, gridRow: 3, gridW: 2, gridH: 3,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          name: 'QQ音乐', path: 'qqmusic', icon: '🎵',
        },
      ],
    },
    {
      id: 'p3',
      label: '时钟',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a1a2e',
      widgets: [
        {
          id: 'w-clock3', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 3,
          freeX: 5, freeY: 5, freeW: 90, freeH: 35,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ffffff', fontSize: 40, fontWeight: 'bolder', borderRadius: 0,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date3', type: 'date', label: '日期',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 1,
          freeX: 5, freeY: 42, freeW: 90, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#a0a0c0', fontSize: 16, fontWeight: 'normal', borderRadius: 0,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true,
        },
        {
          id: 'w-note3', type: 'snippet-list', label: '便签',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 55, freeW: 90, freeH: 40,
          backgroundColor: '#16213e', backgroundOpacity: 100, textColor: '#e0e0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          snippets: [
            { id: 's1', label: '备忘', content: '双击编辑文字' },
          ],
          mode: 'note',
        },
      ],
    },
    {
      id: 'p4',
      label: '快捷',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0f2027',
      widgets: [
        {
          id: 'w-actions4', type: 'quick-action', label: '快捷面板',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 4,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          columns: 2, rows: 2,
          cells: [
            { type: 'launcher', name: '计算器', path: 'calc' },
            { type: 'launcher', name: '相机', path: 'camera' },
            { type: 'launcher', name: '设置', path: 'settings' },
            { type: 'launcher', name: '浏览器', path: 'browser' },
          ],
        },
        {
          id: 'w-clock4', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 16, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: false, showAmpm: false,
        },
      ],
    },
  ],
};

export default template;