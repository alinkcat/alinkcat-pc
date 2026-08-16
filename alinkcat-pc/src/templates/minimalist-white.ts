import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 简约白色模板 - 竖屏
 * 纯白背景，简洁时钟+日期+便签，适合日常使用
 */
const template: EditorTheme = {
  id: 'template-minimalist-white',
  name: '简约白色',
  version: '1.0.0',
  author: '艾联猫',
  description: '纯白背景，简洁时钟+日期+便签，适合日常使用',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#ffffff',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 3,
          freeX: 5, freeY: 5, freeW: 90, freeH: 35,
          backgroundColor: '#f5f5f5', backgroundOpacity: 100, textColor: '#333333', fontSize: 36, fontWeight: 'bolder', borderRadius: 12,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 1,
          freeX: 5, freeY: 42, freeW: 90, freeH: 10,
          backgroundColor: 'transparent', backgroundOpacity: 0, textColor: '#666666', fontSize: 16, fontWeight: 'normal', borderRadius: 0,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true,
        },
        {
          id: 'w-note', type: 'snippet-list', label: '便签',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 55, freeW: 90, freeH: 40,
          backgroundColor: '#fafafa', backgroundOpacity: 100, textColor: '#444444', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          snippets: [
            { id: 's1', label: '事项', content: '今天的重要事项' },
            { id: 's2', label: '备忘', content: '双击编辑文字内容' },
          ],
          mode: 'note',
        },
      ],
    },
  ],
};

export default template;