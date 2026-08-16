import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 媒体控制模板 - 横屏
 * 音乐控制 + 时钟 + 快捷启动，适合配合 PC 播放器使用
 */
const template: EditorTheme = {
  id: 'template-media',
  name: '媒体控制',
  version: '1.0.0',
  author: '艾联猫',
  description: '音乐控制面板，搭配时钟和应用启动器，横屏布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '媒体',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#2d0a31',
      widgets: [
        {
          id: 'w-media', type: 'media-control', label: '音乐控制',
          gridCol: 0, gridRow: 0, gridW: 4, gridH: 3,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          displayMode: 'always', showCover: true, showProgress: true,
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 2,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#e8b4f8', fontSize: 16, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 5, gridW: 2, gridH: 1,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#c084d0', fontSize: 10, fontWeight: 'normal', borderRadius: 8,
          dateFormat: 'YYYY年MM月DD日 星期X', showLunar: false,
        },
        {
          id: 'w-launcher', type: 'launcher', label: '应用启动',
          gridCol: 2, gridRow: 3, gridW: 2, gridH: 3,
          backgroundColor: '#3d1553', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          name: 'QQ 音乐', path: 'qqmusic', icon: '🎵',
        },
      ],
    },
  ],
};

export default template;