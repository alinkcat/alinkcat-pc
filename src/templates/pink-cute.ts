import type { EditorTheme } from '../pages/Editor/types';

/**
 * 粉色可爱模板 - 竖屏
 * 粉色主题，圆角组件，可爱风格，适合少女心用户
 */
const template: EditorTheme = {
  id: 'template-pink-cute',
  name: '粉色可爱',
  version: '1.0.0',
  author: '艾联猫',
  description: '粉色主题，圆角组件，可爱风格，适合少女心用户',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#fff0f5',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          freeX: 5, freeY: 5, freeW: 90, freeH: 28,
          backgroundColor: '#ffe4ec', backgroundOpacity: 100, textColor: '#d6336c', fontSize: 28, fontWeight: 'bolder', borderRadius: 20,
          format24h: false, showSeconds: true, showAmpm: true,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 4, gridH: 1,
          freeX: 5, freeY: 35, freeW: 90, freeH: 10,
          backgroundColor: '#ffe4ec', backgroundOpacity: 100, textColor: '#e64980', fontSize: 14, fontWeight: 'normal', borderRadius: 20,
          dateFormat: 'YYYY年MM月DD日', showLunar: false,
        },
        {
          id: 'w-message', type: 'text', label: '每日一句',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 1,
          freeX: 5, freeY: 48, freeW: 90, freeH: 12,
          backgroundColor: '#ffe4ec', backgroundOpacity: 100, textColor: '#d6336c', fontSize: 12, fontWeight: 'normal', borderRadius: 20,
          content: '🌸 每一天都是美好的开始 ✨', textAlign: 'center',
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 63, freeW: 90, freeH: 32,
          backgroundColor: '#ffe4ec', backgroundOpacity: 100, textColor: '#d6336c', fontSize: 12, fontWeight: 'normal', borderRadius: 20,
          columns: 2, rows: 1,
          cells: [
            { type: 'launcher', name: '相机', path: 'camera' },
            { type: 'launcher', name: '相册', path: 'gallery' },
          ],
        },
      ],
    },
  ],
};

export default template;