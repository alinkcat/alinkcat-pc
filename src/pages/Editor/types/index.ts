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

// ─── common widget base props ────────────────────────────────
export interface WidgetBase {
  // keep index signature，for dynamic prop passing in editorToThemeMeta / themeToEditor
  [key: string]: unknown;
  id: string;
  label: string;
  gridCol: number;
  gridRow: number;
  gridW: number;
  gridH: number;
  freeX?: number;
  freeY?: number;
  freeW?: number;
  freeH?: number;
  zIndex?: number;
  borderRadius?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder';
  /** click action */
  clickAction?: { type: string; keys?: string[]; path?: string; url?: string; targetPage?: string; script?: string; command?: string; args?: string[] };
  /** linkage event type */
  triggerEvent?: 'switch_page' | 'toggle_widget' | 'update_data' | 'trigger_action';
  /** linkage target widget id */
  targetWidgetId?: string;
}

// one interface per widget type（discriminated union）
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
  /** show weekday below the time */
  showWeekday?: boolean;
  /** display mode: digital(digital clock) / analog(analog clock) */
  clockDisplay?: 'digital' | 'analog';
  /** analog: show tick marks */
  tickMarks?: boolean;
  /** analog: show numbers 1-12 */
  showNumbers?: boolean;
  /** analog: hand style classic / modern / thin */
  handStyle?: 'classic' | 'modern' | 'thin';
  /** analog: dial color */
  faceColor?: string;
  /** analog: hand color */
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
  /** click action */
  clickAction?: { type: string; keys?: string[]; url?: string; targetPage?: string };
}
interface ImageWidget extends WidgetBase {
  type: 'image';
  src?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  /** click action */
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
  /** custom request headers（e.g. Authorization: Bearer <token>，JWT auth） */
  headers?: Record<string, string>;
  titleField?: string;
  descField?: string;
  timeField?: string;
  linkField?: string;
  preset?: string;
  bilibiliRoomId?: string;
  /** legacy weather fields（deprecated，compatible with old themes） */
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  /** general weather config：request details */
  requestUrl?: string;
  requestMethod?: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  city?: string;
  apiKey?: string;
  extraParams?: Record<string, string>;
  unit?: 'c' | 'f';
  refreshHours?: number;
  /** response field mapping：target field → JSON path（e.g. main.temp / weather[0].icon） */
  responseMapping?: Record<string, string>;
  showScrollbar?: boolean;
}
/** weather widget：created directly from the widget library 'weather'，fields match the webview weather preset，shared by both sides */
interface WeatherWidget extends WidgetBase {
  type: 'weather';
  url?: string;
  displayMode?: string;
  preset?: string;
  /** legacy weather fields（deprecated，compatible with old themes） */
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  /** general weather config：request details */
  requestUrl?: string;
  requestMethod?: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  city?: string;
  apiKey?: string;
  extraParams?: Record<string, string>;
  unit?: 'c' | 'f';
  refreshHours?: number;
  /** response field mapping：target field → JSON path（e.g. main.temp / weather[0].icon） */
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
  /** click action */
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
  /** theme default orientation: portrait / landscape */
  orientation?: 'portrait' | 'landscape';
  pages: EditorPage[];
}
