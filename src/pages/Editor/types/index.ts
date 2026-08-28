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
  zIndex?: number;
  borderRadius?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder';
  /** 点击动作 */
  clickAction?: { type: string; keys?: string[]; path?: string; url?: string; targetPage?: string; script?: string; command?: string; args?: string[] };
  /** 联动事件类型 */
  triggerEvent?: 'switch_page' | 'toggle_widget' | 'update_data' | 'trigger_action';
  /** 联动目标控件 ID */
  targetWidgetId?: string;
}

// 每个 widget 具体类型一个接口（discriminated union）
interface ButtonWidget extends WidgetBase {
  type: 'button';
  icon?: string;
  action?: { type: string; keys?: string[]; path?: string; url?: string; targetPage?: string; script?: string; command?: string; args?: string[] };
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
interface BatteryWidget extends WidgetBase {
  type: 'battery';
  batteryStyle?: 'bar' | 'ring' | 'number';
  showLevel?: boolean;
  showCharging?: boolean;
  showTemp?: boolean;
  barColor?: string;
  lowColor?: string;
  lowThreshold?: number;
  dataSource?: string;
}
interface ClockWidget extends WidgetBase {
  type: 'clock';
  format24h?: boolean;
  showSeconds?: boolean;
  showAmpm?: boolean;
  /** 时间下方显示星期几 */
  showWeekday?: boolean;
  /** 显示模式: digital(数字时钟) / analog(模拟时钟) */
  clockDisplay?: 'digital' | 'analog';
  /** 模拟钟: 是否显示刻度 */
  tickMarks?: boolean;
  /** 模拟钟: 是否显示数字 1-12 */
  showNumbers?: boolean;
  /** 模拟钟: 指针样式 classic / modern / thin */
  handStyle?: 'classic' | 'modern' | 'thin';
  /** 模拟钟: 表盘颜色 */
  faceColor?: string;
  /** 模拟钟: 指针颜色 */
  handColor?: string;
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
  /** 点击动作 */
  clickAction?: { type: string; keys?: string[]; url?: string; targetPage?: string };
}
interface ImageWidget extends WidgetBase {
  type: 'image';
  src?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  /** 点击动作 */
  clickAction?: { type: string; keys?: string[]; url?: string; targetPage?: string };
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
  /** 旧版天气字段（已废弃，兼容旧主题） */
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  /** 通用天气配置：请求细节 */
  requestUrl?: string;
  requestMethod?: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  city?: string;
  apiKey?: string;
  extraParams?: Record<string, string>;
  unit?: 'c' | 'f';
  refreshHours?: number;
  /** 响应字段映射：目标字段 → JSON 路径（如 main.temp / weather[0].icon） */
  responseMapping?: Record<string, string>;
  showScrollbar?: boolean;
}
/** 天气组件：由控件库「天气」直接创建，字段与 webview 的 weather 预设保持一致，两端通用 */
interface WeatherWidget extends WidgetBase {
  type: 'weather';
  url?: string;
  displayMode?: string;
  preset?: string;
  /** 旧版天气字段（已废弃，兼容旧主题） */
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  /** 通用天气配置：请求细节 */
  requestUrl?: string;
  requestMethod?: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  city?: string;
  apiKey?: string;
  extraParams?: Record<string, string>;
  unit?: 'c' | 'f';
  refreshHours?: number;
  /** 响应字段映射：目标字段 → JSON 路径（如 main.temp / weather[0].icon） */
  responseMapping?: Record<string, string>;
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
  /** 点击动作 */
  clickAction?: { type: string; keys?: string[]; url?: string; targetPage?: string };
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
interface CardWidget extends WidgetBase {
  type: 'card';
  cardTitle?: string;
  cardDesc?: string;
  cardImage?: string;
  cardImagePosition?: 'top' | 'left' | 'right';
  cardTags?: string[];
  cardFooter?: string;
}

export type EditorWidget =
  | ButtonWidget
  | GaugeWidget
  | BatteryWidget
  | ClockWidget
  | DateWidget
  | CalendarWidget
  | TextWidget
  | ImageWidget
  | ShapeWidget
  | WebViewWidget
  | WeatherWidget
  | MediaWidget
  | SystemMonitorWidget
  | QuickActionWidget
  | LauncherWidget
  | StickyNoteWidget
  | IconWidget
  | CardWidget
  | WeatherWidget;

export interface PerfSnapshot {
  timestamp: number;
  cpu?: number;
  memory?: number;
  network?: { upload: number; download: number };
  disk?: number;
  uptime?: number;
  battery?: { level: number; charging?: boolean; temperature?: number };
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
  /** 主题默认方向：portrait 竖屏 / landscape 横屏 */
  orientation?: 'portrait' | 'landscape';
  pages: EditorPage[];
}
