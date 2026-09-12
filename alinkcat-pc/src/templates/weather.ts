import type { EditorTheme } from '../pages/Editor/types';

/**
 * 天气时钟模板 - 竖屏
 * 时钟 + 日期 + 天气 WebView + 快捷面板，适合日常使用
 */
const template: EditorTheme = {
  id: 'template-weather',
  name: '天气时钟',
  version: '1.0.0',
  author: '艾联猫',
  description: '显示时间、日期、天气信息，附带快捷面板，适合日常使用',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '主页',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0f2027',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 2,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 18, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 1,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#a0d0e0', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          dateFormat: 'YYYY年MM月DD日', showLunar: false,
        },
        {
          id: 'w-weather', type: 'webview', label: '天气',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 1,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800,
          titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '',
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷面板',
          gridCol: 0, gridRow: 3, gridW: 4, gridH: 3,
          backgroundColor: '#1a3a4a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          columns: 2, rows: 2,
          cells: [
            { type: 'launcher', name: '计算器', path: 'calc' },
            { type: 'launcher', name: '记事本', path: 'notepad' },
            { type: 'snippet', title: '欢迎语', snippets: [{ id: 's1', label: '您好', content: '您好，欢迎咨询！' }] },
            { type: 'snippet', title: '结束语', snippets: [{ id: 's2', label: '感谢', content: '感谢您的咨询！' }] },
          ],
        },
      ],
    },
  ],
};

export default template;