import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 空白模板 - 竖屏
 * 提供干净的画布，适合白手起家用户
 */
const template: EditorTheme = {
  id: 'template-blank',
  name: '空白模板',
  version: '1.0.0',
  author: '艾联猫',
  description: '从零开始，自由创作',
  source: 'local',
  pages: [
    {
      id: 'page-default',
      label: '主页',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#ffffff',
      widgets: [],
    },
  ],
};

export default template;