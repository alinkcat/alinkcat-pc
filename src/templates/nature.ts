import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 自然风光模板 - 竖屏
 * 渐变绿色，时钟+日期+天气，清新自然
 */
const template: EditorTheme = {
  id: 'template-nature',
  name: '自然风光',
  version: '1.0.0',
  author: '艾联猫',
  description: '渐变绿色，时钟+日期+天气，清新自然风格',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '自然',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a3a2a',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          freeX: 5, freeY: 5, freeW: 90, freeH: 28,
          backgroundColor: '#2a5a3a', backgroundOpacity: 100, textColor: '#e8f5e9', fontSize: 28, fontWeight: 'bolder', borderRadius: 16,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 1,
          freeX: 5, freeY: 36, freeW: 42, freeH: 10,
          backgroundColor: '#2a5a3a', backgroundOpacity: 100, textColor: '#a8d5a2', fontSize: 14, fontWeight: 'normal', borderRadius: 12,
          dateFormat: 'YYYY年MM月DD日', showLunar: true,
        },
        {
          id: 'w-weather', type: 'webview', label: '天气',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 1,
          freeX: 53, freeY: 36, freeW: 42, freeH: 10,
          backgroundColor: '#2a5a3a', backgroundOpacity: 100, textColor: '#e8f5e9', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800,
          titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '',
        },
        {
          id: 'w-note', type: 'text', label: '心情',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 1,
          freeX: 5, freeY: 50, freeW: 90, freeH: 12,
          backgroundColor: '#2a5a3a', backgroundOpacity: 100, textColor: '#c8e6c9', fontSize: 14, fontWeight: 'normal', borderRadius: 12,
          content: '🌿 今日心情：拥抱自然，感受生活', textAlign: 'center',
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷面板',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          freeX: 5, freeY: 65, freeW: 90, freeH: 30,
          backgroundColor: '#2a5a3a', backgroundOpacity: 100, textColor: '#e8f5e9', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          columns: 2, rows: 1,
          cells: [
            { type: 'launcher', name: '闹钟', path: 'alarm' },
            { type: 'launcher', name: '计时器', path: 'timer' },
          ],
        },
      ],
    },
  ],
};

export default template;