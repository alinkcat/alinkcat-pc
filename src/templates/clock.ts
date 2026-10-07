import type { EditorTheme } from '../pages/Editor/types';

/**
 * Minimal clock template - portrait
 * large-font clock + date + notes，as a phone home screen
 */
const template: EditorTheme = {
  id: 'template-clock',
  name: '极简时钟',
  version: '1.0.0',
  author: '艾联猫',
  description: '大字体时钟搭配日期和便签，简约清晰，竖屏布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a1a2e',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 3,
          freeX: 5, freeY: 5, freeW: 90, freeH: 35,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ffffff', fontSize: 36, fontWeight: 'bolder', borderRadius: 0,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 1,
          freeX: 5, freeY: 42, freeW: 90, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#a0a0c0', fontSize: 16, fontWeight: 'normal', borderRadius: 0,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true,
        },
        {
          id: 'w-note', type: 'snippet-list', label: '今日待办',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 55, freeW: 90, freeH: 40,
          backgroundColor: '#16213e', backgroundOpacity: 100, textColor: '#e0e0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          snippets: [
            { id: 's1', label: '事项', content: '今日待办事项' },
            { id: 's2', label: '备忘', content: '双击编辑文字' },
          ],
          mode: 'note',
        },
      ],
    },
  ],
};

export default template;