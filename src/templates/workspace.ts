import type { EditorTheme } from '../pages/Editor/types';

/**
 * Workspace template - portrait
 * todos + clock + calendar + app launcher，light
 */
const template: EditorTheme = {
  id: 'template-workspace',
  name: '工作台',
  version: '1.0.0',
  author: '艾联猫',
  description: '待办事项+时钟+日历+应用启动，适合办公场景',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '工作台',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#f0f2f5',
      widgets: [
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#262626', fontSize: 20, fontWeight: 'bold', borderRadius: 10,
          format24h: true, showSeconds: true, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 1,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#595959', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          dateFormat: 'YYYY年MM月DD日', showLunar: false,
        },
        {
          id: 'w-greeting', type: 'text', label: '问候',
          gridCol: 2, gridRow: 1, gridW: 2, gridH: 1,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#8c8c8c', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          content: '☕ 上午好，开始新一天！', textAlign: 'center',
        },
        {
          id: 'w-calendar', type: 'calendar', label: '日历',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#262626', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          viewMode: 'month', highlightToday: true,
        },
        {
          id: 'w-todo', type: 'snippet-list', label: '待办事项',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#262626', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          snippets: [
            { id: 's1', label: '高优先级', content: '完成项目报告' },
            { id: 's2', label: '中优先级', content: '回复邮件' },
          ],
          mode: 'note',
        },
        {
          id: 'w-launcher', type: 'launcher', label: '应用启动',
          gridCol: 0, gridRow: 4, gridW: 4, gridH: 2,
          backgroundColor: '#ffffff', backgroundOpacity: 100, textColor: '#262626', fontSize: 12, fontWeight: 'normal', borderRadius: 10,
          name: '打开工作区', path: 'workspace', icon: '💼',
        },
      ],
    },
  ],
};

export default template;