import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 户外运动模板 - 竖屏
 * 运动风格，健康数据+时钟+天气，适合户外爱好者
 */
const template: EditorTheme = {
  id: 'template-outdoor-sports',
  name: '户外运动',
  version: '1.0.0',
  author: '艾联猫',
  description: '运动风格，健康数据+时钟+天气，适合户外爱好者',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '运动',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#1a2e1a',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 20, fontWeight: 'bold', borderRadius: 10,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 1,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#a0d0a0', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-weather', type: 'webview', label: '天气',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 1,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          displayMode: 'json', jsonUrl: 'https://wttr.in/Beijing?format=j1', refreshInterval: 1800,
          titleField: 'current_condition.0.weatherDesc.0.value', descField: 'current_condition.0.temp_C', timeField: 'current_condition.0.observation_time', linkField: '',
        },
        {
          id: 'w-steps', type: 'gauge', label: '步数',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'bold', borderRadius: 10,
          dataSource: 'system.cpu.usage', unit: '步', gaugeStyle: 'number', minValue: 0, maxValue: 10000,
          ringColorLow: '#4caf50', ringColorMid: '#ff9800', ringColorHigh: '#f44336', ringWidth: 3,
        },
        {
          id: 'w-heart', type: 'gauge', label: '心率',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#ff6b6b', fontSize: 12, fontWeight: 'bold', borderRadius: 10,
          dataSource: 'system.cpu.usage', unit: 'bpm', gaugeStyle: 'ring', minValue: 40, maxValue: 200,
          ringColorLow: '#4caf50', ringColorMid: '#ff9800', ringColorHigh: '#f44336', ringWidth: 3,
        },
        {
          id: 'w-motivation', type: 'text', label: '鼓励语',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          backgroundColor: '#2a5a2a', backgroundOpacity: 100, textColor: '#a0d0a0', fontSize: 14, fontWeight: 'normal', borderRadius: 10,
          content: '🏃 生命在于运动，今天也要加油！', textAlign: 'center',
        },
      ],
    },
  ],
};

export default template;