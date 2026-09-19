import type { EditorTheme } from '../pages/Editor/types';

/**
 * Music wall template - landscape
 * large-cover music + lyrics + clock，dark
 */
const template: EditorTheme = {
  id: 'template-music-wall',
  name: '音乐墙',
  version: '1.0.0',
  author: '艾联猫',
  description: '大封面音乐控制+歌词+时钟，深色风格',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '音乐',
      layoutMode: 'free',
      columns: 4,
      rows: 6,
      backgroundColor: '#0d0d0d',
      widgets: [
        {
          id: 'w-cover', type: 'image', label: '封面',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 3,
          freeX: 3, freeY: 3, freeW: 44, freeH: 50,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          src: '', objectFit: 'cover',
        },
        {
          id: 'w-media', type: 'media-control', label: '音乐控制',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 2,
          freeX: 50, freeY: 3, freeW: 47, freeH: 32,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 12, fontWeight: 'normal', borderRadius: 12,
          displayMode: 'always', showCover: false, showProgress: true,
        },
        {
          id: 'w-lyrics', type: 'text', label: '歌词',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 1,
          freeX: 50, freeY: 38, freeW: 47, freeH: 15,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#888888', fontSize: 11, fontWeight: 'normal', borderRadius: 12,
          content: '🎵 此刻正在播放...', textAlign: 'center',
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 0, gridRow: 3, gridW: 2, gridH: 1,
          freeX: 3, freeY: 56, freeW: 44, freeH: 16,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#ffffff', fontSize: 16, fontWeight: 'bold', borderRadius: 12,
          format24h: true, showSeconds: false, showAmpm: false,
        },
        {
          id: 'w-date', type: 'date', label: '日期',
          gridCol: 0, gridRow: 4, gridW: 2, gridH: 1,
          freeX: 3, freeY: 74, freeW: 44, freeH: 10,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#666666', fontSize: 11, fontWeight: 'normal', borderRadius: 12,
          dateFormat: 'YYYY/MM/DD', showLunar: false,
        },
        {
          id: 'w-playlist', type: 'snippet-list', label: '播放列表',
          gridCol: 2, gridRow: 3, gridW: 2, gridH: 3,
          freeX: 50, freeY: 56, freeW: 47, freeH: 40,
          backgroundColor: '#1a1a1a', backgroundOpacity: 100, textColor: '#cccccc', fontSize: 11, fontWeight: 'normal', borderRadius: 12,
          snippets: [
            { id: 's1', label: '曲目1', content: '当前播放' },
            { id: 's2', label: '曲目2', content: '待播放' },
          ],
          mode: 'list',
        },
      ],
    },
  ],
};

export default template;