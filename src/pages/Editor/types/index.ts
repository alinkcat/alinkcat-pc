export interface EditorPage {
  id: string;
  label: string;
  layoutMode: 'grid' | 'free';
  columns: number;
  rows: number;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundMode?: 'cover' | 'contain' | 'stretch' | 'repeat';
  backgroundOpacity?: number;
  widgets: EditorWidget[];
}

// ─── Widget 公共基础属性 ────────────────────────────────
export interface WidgetBase {
  // 保留索引签名，兼容 editorToThemeMeta / themeToEditor 中 Object.fromEntries 动态属性传递
  [key: string]: unknown;
  id: string;
  label: string;
  gridCol: number;
  gridRow: number;
  gridW: number;
  gridH: number;
  freeX: number;
  freeY: number;
  freeW: number;
  freeH: number;
  borderRadius?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder';
}

// 每个 widget 具体类型一个接口（discriminated union）
interface ButtonWidget extends WidgetBase {
  type: 'button';
  icon?: string;
  action?: { type: string; keys?: string[] };
}
interface GaugeWidget extends WidgetBase {
  type: 'gauge';
  dataSource?: string;
  unit?: string;
  gaugeStyle?: 'ring' | 'number' | 'bar';
  minValue?: number;
  maxValue?: number;
  ringColorLow?: string;
  ringColorMid?: string;
  ringColorHigh?: string;
  ringWidth?: number;
}
interface ClockWidget extends WidgetBase {
  type: 'clock';
  format24h?: boolean;
  showSeconds?: boolean;
  showAmpm?: boolean;
}
interface DateWidget extends WidgetBase {
  type: 'date';
  dateFormat?: string;
  showLunar?: boolean;
}
interface CalendarWidget extends WidgetBase {
  type: 'calendar';
  viewMode?: 'month' | 'week';
  highlightToday?: boolean;
}
interface TextWidget extends WidgetBase {
  type: 'text';
  content?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
}
interface ImageWidget extends WidgetBase {
  type: 'image';
  src?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}
interface ShapeWidget extends WidgetBase {
  type: 'shape';
  shapeType?: 'rect' | 'circle' | 'line';
  fillType?: string;
  fillColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}
interface WebViewWidget extends WidgetBase {
  type: 'webview';
  url?: string;
  displayMode?: string;
  rssUrl?: string;
  jsonUrl?: string;
  refreshInterval?: number;
  titleField?: string;
  descField?: string;
  timeField?: string;
  linkField?: string;
  preset?: string;
  bilibiliRoomId?: string;
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  showScrollbar?: boolean;
}
interface MediaWidget extends WidgetBase {
  type: 'media-control';
  displayMode?: string;
  showCover?: boolean;
  showProgress?: boolean;
}
interface SystemMonitorWidget extends WidgetBase {
  type: 'system-monitor';
  showCPU?: boolean;
  showMemory?: boolean;
  showDisk?: boolean;
  showNetwork?: boolean;
  refreshInterval?: number;
}
interface QuickActionWidget extends WidgetBase {
  type: 'quick-action';
  columns?: number;
  rows?: number;
  cells?: unknown[];
}
interface LauncherWidget extends WidgetBase {
  type: 'launcher';
  name?: string;
  path?: string;
  icon?: string;
}
interface StickyNoteWidget extends WidgetBase {
  type: 'snippet-list';
  snippets?: unknown[];
  mode?: string;
}
interface IconWidget extends WidgetBase {
  type: 'icon';
}

export type EditorWidget =
  | ButtonWidget
  | GaugeWidget
  | ClockWidget
  | DateWidget
  | CalendarWidget
  | TextWidget
  | ImageWidget
  | ShapeWidget
  | WebViewWidget
  | MediaWidget
  | SystemMonitorWidget
  | QuickActionWidget
  | LauncherWidget
  | StickyNoteWidget
  | IconWidget;

export interface PerfSnapshot {
  timestamp: number;
  cpu?: number;
  memory?: number;
  network?: { upload: number; download: number };
  disk?: number;
  uptime?: number;
}

export interface SnippetItem {
  id: string;
  label: string;
  content: string;
}

export interface EditorTheme {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  source?: string;
  market_id?: string;
  downloaded_at?: string;
  pages: EditorPage[];
}
