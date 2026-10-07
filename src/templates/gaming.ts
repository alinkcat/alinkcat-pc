import type { EditorTheme } from '../pages/Editor/types';

/**
 * Gaming template - landscape
 * game-themed colors，RGB lighting style，buttons + monitor + clock
 */
const template: EditorTheme = {
  id: 'template-gaming',
  name: '游戏风格',
  version: '1.0.0',
  author: '艾联猫',
  description: '游戏主题配色，RGB灯效风格，按钮+监控+时钟',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '游戏主页',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a0a2e',
      widgets: [
        {
          id: 'w-title', type: 'text', label: '标题',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 1,
          freeX: 5, freeY: 3, freeW: 90, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ff6b35', fontSize: 20, fontWeight: 'bold', borderRadius: 0,
          content: '🎮 GAMING DASHBOARD', textAlign: 'center',
        },
        {
          id: 'w-cpu', type: 'gauge', label: 'CPU',
          gridCol: 0, gridRow: 1, gridW: 2, gridH: 2,
          freeX: 5, freeY: 18, freeW: 42, freeH: 30,
          backgroundColor: '#2d1b4e', backgroundOpacity: 100, textColor: '#00ff88', fontSize: 12, fontWeight: 'bold', borderRadius: 8,
          dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100,
          ringColorLow: '#00ff88', ringColorMid: '#ffaa00', ringColorHigh: '#ff3355', ringWidth: 4,
        },
        {
          id: 'w-gpu', type: 'gauge', label: 'GPU',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 2,
          freeX: 53, freeY: 18, freeW: 42, freeH: 30,
          backgroundColor: '#2d1b4e', backgroundOpacity: 100, textColor: '#00ddff', fontSize: 12, fontWeight: 'bold', borderRadius: 8,
          dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100,
          ringColorLow: '#00ddff', ringColorMid: '#aa66ff', ringColorHigh: '#ff00aa', ringWidth: 4,
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 1,
          freeX: 5, freeY: 52, freeW: 42, freeH: 18,
          backgroundColor: '#2d1b4e', backgroundOpacity: 100, textColor: '#ff6b35', fontSize: 16, fontWeight: 'bold', borderRadius: 8,
          format24h: false, showSeconds: true, showAmpm: true,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 4, gridW: 2, gridH: 1,
          freeX: 5, freeY: 72, freeW: 42, freeH: 10,
          backgroundColor: '#2d1b4e', backgroundOpacity: 100, textColor: '#aa66ff', fontSize: 10, fontWeight: 'normal', borderRadius: 8,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-launcher', type: 'launcher', label: '启动游戏',
          gridCol: 2, gridRow: 3, gridW: 2, gridH: 3,
          freeX: 53, freeY: 52, freeW: 42, freeH: 42,
          backgroundColor: '#2d1b4e', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 14, fontWeight: 'bold', borderRadius: 8,
          name: '启动游戏', path: 'steam', icon: '🎮',
        },
      ],
    },
  ],
};

export default template;