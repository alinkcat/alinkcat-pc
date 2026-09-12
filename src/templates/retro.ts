import type { EditorTheme } from '../pages/Editor/types';

/**
 * 复古怀旧模板 - 竖屏
 * 暖色调，复古字体，时钟+日期，怀旧风格
 */
const template: EditorTheme = {
  id: 'template-retro',
  name: '复古怀旧',
  version: '1.0.0',
  author: '艾联猫',
  description: '暖色调，复古风格，时钟+日期+日历，怀旧体验',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#f5e6d3',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          backgroundColor: '#d4a574', backgroundOpacity: 100, textColor: '#3e2723', fontSize: 22, fontWeight: 'bold', borderRadius: 4,
          format24h: false, showSeconds: true, showAmpm: true,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 4, gridH: 1,
          backgroundColor: '#d4a574', backgroundOpacity: 100, textColor: '#4e342e', fontSize: 13, fontWeight: 'normal', borderRadius: 4,
          dateFormat: 'YYYY年MM月DD日', showLunar: true,
        },
        {
          id: 'w-calendar', type: 'calendar', label: '日历',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 3,
          backgroundColor: '#d4a574', backgroundOpacity: 100, textColor: '#3e2723', fontSize: 12, fontWeight: 'normal', borderRadius: 4,
          viewMode: 'month', highlightToday: true,
        },
      ],
    },
  ],
};

export default template;