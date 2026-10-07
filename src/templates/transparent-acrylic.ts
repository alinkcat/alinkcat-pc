import type { EditorTheme } from '../pages/Editor/types';

/**
 * Transparent acrylic template - portrait
 * transparent bg + frosted glass，minimal widgets，modern look
 */
const template: EditorTheme = {
  id: 'template-transparent-acrylic',
  name: '透明亚克力',
  version: '1.0.0',
  author: '艾联猫',
  description: '透明背景+毛玻璃效果，极简组件，现代感',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#f0f2f5',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          freeX: 5, freeY: 5, freeW: 90, freeH: 28,
          backgroundColor: 'rgba(255,255,255,0.6)', backgroundOpacity: 60, textColor: '#1a1a2e', fontSize: 28, fontWeight: 'bolder', borderRadius: 16,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 4, gridH: 1,
          freeX: 5, freeY: 36, freeW: 90, freeH: 10,
          backgroundColor: 'rgba(255,255,255,0.4)', backgroundOpacity: 40, textColor: '#555577', fontSize: 14, fontWeight: 'normal', borderRadius: 16,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: false,
        },
        {
          id: 'w-note', type: 'text', label: '便签',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 1,
          freeX: 5, freeY: 50, freeW: 90, freeH: 12,
          backgroundColor: 'rgba(255,255,255,0.5)', backgroundOpacity: 50, textColor: '#333355', fontSize: 12, fontWeight: 'normal', borderRadius: 16,
          content: '📝 点击此处添加笔记...', textAlign: 'center',
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 65, freeW: 90, freeH: 30,
          backgroundColor: 'rgba(255,255,255,0.5)', backgroundOpacity: 50, textColor: '#1a1a2e', fontSize: 12, fontWeight: 'normal', borderRadius: 16,
          columns: 2, rows: 1,
          cells: [
            { type: 'launcher', name: '天气', path: 'weather' },
            { type: 'launcher', name: '音乐', path: 'music' },
          ],
        },
      ],
    },
  ],
};

export default template;