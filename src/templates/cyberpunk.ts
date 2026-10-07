import type { EditorTheme } from '../pages/Editor/types';

/**
 * Cyberpunk monitor template - landscape
 * neon data monitor + clock，for power users
 */
const template: EditorTheme = {
  id: 'template-cyberpunk',
  name: '赛博朋克监控',
  version: '1.0.0',
  author: '艾联猫',
  description: '赛博朋克风格，霓虹配色 + 系统监控，横屏布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '监控',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#0d0221',
      widgets: [
        {
          id: 'w-title', type: 'text', label: '标题',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 1,
          freeX: 5, freeY: 3, freeW: 90, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ff00ff', fontSize: 18, fontWeight: 'bold', borderRadius: 0,
          content: '⚡ SYSTEM MONITOR', textAlign: 'center',
        },
        {
          id: 'w-cpu', type: 'gauge', label: 'CPU',
          gridCol: 0, gridRow: 1, gridW: 2, gridH: 2,
          freeX: 5, freeY: 18, freeW: 42, freeH: 32,
          backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'bold', borderRadius: 4,
          dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100,
          ringColorLow: '#00ffff', ringColorMid: '#ff00ff', ringColorHigh: '#ff0055', ringWidth: 4,
        },
        {
          id: 'w-mem', type: 'gauge', label: '内存',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 2,
          freeX: 53, freeY: 18, freeW: 42, freeH: 32,
          backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'bold', borderRadius: 4,
          dataSource: 'system.memory.usage', unit: '%', gaugeStyle: 'number', minValue: 0, maxValue: 100,
          ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3,
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 1,
          freeX: 5, freeY: 55, freeW: 42, freeH: 18,
          backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#ff00ff', fontSize: 14, fontWeight: 'bold', borderRadius: 4,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 4, gridW: 2, gridH: 1,
          freeX: 5, freeY: 75, freeW: 42, freeH: 10,
          backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#8844ff', fontSize: 10, fontWeight: 'normal', borderRadius: 4,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-net', type: 'system-monitor', label: '网络',
          gridCol: 2, gridRow: 3, gridW: 2, gridH: 3,
          freeX: 53, freeY: 55, freeW: 42, freeH: 40,
          backgroundColor: '#1a0033', backgroundOpacity: 100, textColor: '#00ffff', fontSize: 12, fontWeight: 'normal', borderRadius: 4,
          showCPU: false, showMemory: false, showDisk: false, showNetwork: true, refreshInterval: 2,
        },
      ],
    },
  ],
};

export default template;