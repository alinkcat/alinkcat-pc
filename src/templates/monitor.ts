import type { EditorTheme } from '../../pages/Editor/types';

/**
 * 系统监控模板 - 横屏
 * 展示 CPU、内存、磁盘、网络监控数据，适合高级用户
 */
const template: EditorTheme = {
  id: 'template-monitor',
  name: '系统监控',
  version: '1.0.0',
  author: '艾联猫',
  description: '实时监控 CPU、内存、磁盘、网络状态，横屏布局',
  source: 'local',
  pages: [
    {
      id: 'p1',
      label: '监控主页',
      layoutMode: 'grid',
      columns: 4,
      rows: 6,
      backgroundColor: '#0a0e1a',
      widgets: [
        {
          id: 'w-cpu', type: 'system-monitor', label: 'CPU',
          gridCol: 0, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: true, showMemory: false, showDisk: false, showNetwork: false, refreshInterval: 2,
        },
        {
          id: 'w-mem', type: 'system-monitor', label: '内存',
          gridCol: 2, gridRow: 0, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: true, showDisk: false, showNetwork: false, refreshInterval: 2,
        },
        {
          id: 'w-disk', type: 'system-monitor', label: '磁盘',
          gridCol: 0, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: false, showDisk: true, showNetwork: false, refreshInterval: 5,
        },
        {
          id: 'w-net', type: 'system-monitor', label: '网络',
          gridCol: 2, gridRow: 2, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          showCPU: false, showMemory: false, showDisk: false, showNetwork: true, refreshInterval: 2,
        },
        {
          id: 'w-gauge', type: 'gauge', label: 'CPU 温度',
          gridCol: 0, gridRow: 4, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 12, fontWeight: 'normal', borderRadius: 8,
          dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100,
          ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3,
        },
        {
          id: 'w-clock', type: 'clock', label: '时钟',
          gridCol: 2, gridRow: 4, gridW: 2, gridH: 2,
          backgroundColor: '#121828', backgroundOpacity: 100, textColor: '#e8e8e8', fontSize: 14, fontWeight: 'bold', borderRadius: 8,
          format24h: true, showSeconds: true, showAmpm: false,
        },
      ],
    },
  ],
};

export default template;