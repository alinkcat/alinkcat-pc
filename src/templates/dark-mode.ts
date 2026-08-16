import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 深色模式模板 - 竖屏
 * 深灰背景，暗色风格，适合夜间使用
 */
const template: EditorTheme = {
  id: 'template-dark-mode',
  name: '深色模式',
  version: '1.0.0',
  author: '艾联猫',
  description: '深灰背景，暗色风格，适合夜间使用',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#1c1c1e',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          backgroundColor: '#2c2c2e', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 20, fontWeight: 'bold', borderRadius: 10,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 1,
          backgroundColor: '#2c2c2e', backgroundOpacity: 100, textColor: '#a0a0a0', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-battery', type: 'text', label: '状态',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 1,
          backgroundColor: '#2c2c2e', backgroundOpacity: 100, textColor: '#34c759', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          content: '🔋 电量 85% · 📶 信号强', textAlign: 'center',
        },
        {
          id: 'w-calendar', type: 'calendar', label: '日历',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 3,
          backgroundColor: '#2c2c2e', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          viewMode: 'month', highlightToday: true,
        },
      ],
    },
  ],
};

export default template;