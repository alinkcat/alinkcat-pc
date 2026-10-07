export interface WidgetDefinition {
  id: string;
  type: 'button' | 'gauge' | 'battery' | 'snippet-list' | 'image' | 'icon' | 'text' | 'shape' | 'webview' | 'weather' | 'media-control' | 'system-monitor' | 'quick-action' | 'launcher' | 'clock' | 'date' | 'calendar' | 'card';
  label: string;
  icon?: string;
  action?: string;
  value?: string;
  min?: number;
  max?: number;
  unit?: string;
  items?: SnippetItem[];
  gridCol: number;
  gridRow: number;
  gridW: number;
  gridH: number;
  freeX: number;
  freeY: number;
  freeW: number;
  freeH: number;
  borderRadius?: number;
  objectFit?: 'cover' | 'contain' | 'fill';
  /** linkage event type */
  triggerEvent?: 'switch_page' | 'toggle_widget' | 'update_data' | 'trigger_action';
  /** linkage target widget id */
  targetWidgetId?: string;
  [key: string]: unknown;
}

export interface SnippetItem {
  id: string;
  label: string;
  content: string;
}

export interface LayoutConfig {
  type: 'grid' | 'free';
  columns?: number;
  rows?: number;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundMode?: 'cover' | 'contain' | 'stretch' | 'tile';
  backgroundOpacity?: number;
}

export interface PageDefinition {
  id: string;
  label: string;
  layout: LayoutConfig;
  widgets: WidgetDefinition[];
}

export interface ThemeMeta {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  preview?: string;
  source?: string;
  market_id?: string;
  downloaded_at?: string;
  /** theme default orientation: portrait / landscape */
  orientation?: 'portrait' | 'landscape';
  pages: PageDefinition[];
}

export interface ThemeSummary {
  id: string;
  name: string;
  version: string;
  author: string;
  description?: string;
  preview?: string;
  page_count: number;
  has_cover: boolean;
  cover_url?: string;
  source?: string;
  market_id?: string;
  path: string;
}

export interface ThemeVersion {
  version: string;
  timestamp: string;
  changelog?: string;
  snapshot: ThemeMeta;
}

export interface AppConfig {
  active_theme_id?: string;
  command_whitelist?: string[];
}

export interface ClientInfo {
  client_id: string;
  device_name: string;
  ip_address: string;
  app_version: string;
  connected_at: string;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  connections: number;
}

export interface ConnectionLog {
  time: string;
  message: string;
}

export interface Snippet {
  id: string;
  label: string;
  content: string;
  theme_id: string;
  created_at: string;
}

export interface AppSettings {
  ws_port: number;
  data_interval: number;
  auto_start: boolean;
  log_level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  /** whether to periodically poll local service status（get_server_status / get_connections） */
  status_polling: boolean;
  /** status poll frequency（seconds） */
  status_polling_interval: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ws_port: 9527,
  data_interval: 1000,
  auto_start: false,
  log_level: 'INFO',
  status_polling: false,
  status_polling_interval: 3,
};
