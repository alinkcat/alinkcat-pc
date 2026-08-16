import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 极简时间模板 - 竖屏
 * 超大字体的时钟，只有时间+日期，极简free布局
 */
const template: EditorTheme = {
  id: 'template-minimal-time',
  name: '极简时间',
  version: '1.0.0',
  author: '艾联猫',
  description: '超大字体的时钟，只有时间+日期，极简free布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '时间',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#000000',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 4,
          freeX: 0, freeY: 5, freeW: 100, freeH: 55,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#ffffff', fontSize: 56, fontWeight: 'bolder', borderRadius: 0,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 1,
          freeX: 0, freeY: 62, freeW: 100, freeH: 12,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#888888', fontSize: 20, fontWeight: 'normal', borderRadius: 0,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: false,
        },
        {
          id: 'w-seconds', type: 'text', label: '副标题',
          gridCol: 0, gridRow: 5, gridW: 4, gridH: 1,
          freeX: 0, freeY: 78, freeW: 100, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#555555', fontSize: 14, fontWeight: 'normal', borderRadius: 0,
          content: '「 时间是一切财富中最宝贵的财富 」', textAlign: 'center',
        },
      ],
    },
  ],
};

export default template;