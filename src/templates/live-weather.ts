import type { EditorTheme } from '../pages/Editor/types';

/**
 * Live weather template - portrait
 * weather home + clock + date + quick panel，weather color scheme
 */
const template: EditorTheme = {
  id: 'template-live-weather',
  name: '实时天气',
  version: '1.0.0',
  author: '艾联猫',
  description: '天气主页+时钟+日期+快捷面板，天气主题配色',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '天气',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a3a5c',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#2a5a8c', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 20, fontWeight: 'bold', borderRadius: 12,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 1,
          backgroundColor: '#2a5a8c', backgroundOpacity: 100, textColor: '#a0d0f0', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-weather', type: 'webview', label: '天气',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 1,
          backgroundColor: '#2a5a8c', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800,
          titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '',
        },
        {
          id: 'w-forecast', type: 'text', label: '天气提示',
          gridCol: 0, gridRow: 2, gridW: 4, gridH: 1,
          backgroundColor: '#2a5a8c', backgroundOpacity: 100, textColor: '#80c0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          content: '☀️ 今日天气晴好，适合户外活动', textAlign: 'center',
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷面板',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 3,
          backgroundColor: '#2a5a8c', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          columns: 2, rows: 2,
          cells: [
            { type: 'launcher', name: '天气详情', path: 'weather' },
            { type: 'launcher', name: '空气质量', path: 'air' },
            { type: 'snippet', title: '穿衣指南', snippets: [{ id: 's1', label: '建议', content: '今日气温适中' }] },
            { type: 'snippet', title: '出行建议', snippets: [{ id: 's2', label: '提示', content: '适合出行' }] },
          ],
        },
      ],
    },
  ],
};

export default template;