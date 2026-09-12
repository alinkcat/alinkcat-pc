import type { EditorTheme } from '../pages/Editor/types';

/**
 * 商务风模板 - 竖屏
 * 蓝色系，简洁大方，时钟+日程+天气
 */
const template: EditorTheme = {
  id: 'template-business',
  name: '商务风',
  version: '1.0.0',
  author: '艾联猫',
  description: '蓝色系，简洁大方，时钟+日程+天气，适合办公场景',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '工作台',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#eef2f7',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#1a3a5c', fontSize: 18, fontWeight: 'bold', borderRadius: 10,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 1,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#4a6a8c', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          dateFormat: 'YYYY年MM月DD日', showLunar: false,
        },
        {
          id: 'w-weather', type: 'webview', label: '天气',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 1,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#1a3a5c', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800,
          titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '',
        },
        {
          id: 'w-calendar', type: 'calendar', label: '日历',
          gridCol: 0, gridRow: 2, gridW: 4, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#1a3a5c', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          viewMode: 'month', highlightToday: true,
        },
        {
          id: 'w-actions', type: 'quick-action', label: '快捷操作',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#1a3a5c', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          columns: 2, rows: 2,
          cells: [
            { type: 'launcher', name: '邮件', path: 'mail' },
            { type: 'launcher', name: '日历', path: 'calendar' },
            { type: 'snippet', title: '会议', snippets: [{ id: 's1', label: '周会', content: '每周一10:00' }] },
            { type: 'snippet', title: '任务', snippets: [{ id: 's2', label: '待办', content: '完成报告' }] },
          ],
        },
      ],
    },
  ],
};

export default template;