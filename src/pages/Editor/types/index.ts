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

export interface EditorWidget {
  id: string;
  type: 'button' | 'gauge' | 'snippet-list' | 'image' | 'icon' | 'text' | 'shape' | 'webview' | 'media-control' | 'system-monitor' | 'quick-action' | 'launcher' | 'clock' | 'date' | 'calendar';
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
  gaugeStyle?: 'ring' | 'number' | 'bar';
  backgroundColor?: string;
  backgroundOpacity?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'bolder';
  displayMode?: 'webpage' | 'rss' | 'json' | 'always' | 'playing_only';
  rssUrl?: string;
  jsonUrl?: string;
  refreshInterval?: number;
  titleField?: string;
  descField?: string;
  timeField?: string;
  linkField?: string;
  preset?: 'none' | 'bilibili' | 'weather';
  bilibiliRoomId?: string;
  weatherCity?: string;
  weatherApiKey?: string;
  weatherUnit?: 'c' | 'f';
  // ─── 时钟组件 ───
  format24h?: boolean;
  showSeconds?: boolean;
  showAmpm?: boolean;
  // ─── 日期组件 ───
  dateFormat?: string;
  showLunar?: boolean;
  // ─── 日历组件 ───
  viewMode?: 'month' | 'week';
  highlightToday?: boolean;
  [key: string]: unknown;
}

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
