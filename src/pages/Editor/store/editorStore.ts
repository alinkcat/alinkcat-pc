import { create } from 'zustand';
import type { EditorPage, EditorWidget, EditorTheme, WidgetBase } from '../types';
import type { ThemeMeta, PageDefinition, WidgetDefinition, ThemeVersion } from '../../../types/theme';

function genId(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function makeWidget(type: string, col: number, row: number): EditorWidget {
  const base: WidgetBase = {
    id: genId('w'), type, label: '',
    gridCol: col, gridRow: row, gridW: 1, gridH: 1,
    freeX: 10, freeY: 10, freeW: 30, freeH: 15, zIndex: 0,
    backgroundColor: '#f0f2f5',
    backgroundOpacity: 100,
    textColor: '#333333',
    fontSize: 12,
    fontWeight: 'normal',
    borderRadius: 6,
  };
  switch (type) {
    case 'button': return { ...base, icon: '🔘', action: { type: 'keyboard', keys: [] } } as unknown as EditorWidget;
    case 'gauge': return { ...base, dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100, ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3 } as unknown as EditorWidget;
    case 'snippet-list': return { ...base, snippets: [], backgroundColor: '#fff9e6', mode: 'note' } as unknown as EditorWidget;
    case 'image': return { ...base, src: '', objectFit: 'cover' } as unknown as EditorWidget;
    case 'text': return { ...base, content: '双击编辑文字', fontSize: 16, fontWeight: 'normal', color: '#333333', textAlign: 'left', backgroundColor: 'transparent', backgroundOpacity: 0, padding: 4, borderRadius: 0 } as unknown as EditorWidget;
    case 'shape': return { ...base, shapeType: 'rect', fillType: 'solid', fillColor: '#d9d9d9', gradientStart: '#4F6EF7', gradientEnd: '#52c41a', gradientAngle: 90, borderColor: 'transparent', borderWidth: 0, borderRadius: 0, opacity: 100 } as unknown as EditorWidget;
    case 'webview': return { ...base, url: '', showScrollbar: true, backgroundColor: '#ffffff', displayMode: 'webpage', rssUrl: '', jsonUrl: '', refreshInterval: 0, titleField: 'title', descField: 'description', timeField: 'pubDate', linkField: 'link', headers: {}, preset: 'none', bilibiliRoomId: '', city: '', apiKey: '', unit: 'c', refreshHours: 1, requestMethod: 'GET', requestUrl: '', requestHeaders: {}, extraParams: {}, responseMapping: {} } as unknown as EditorWidget;
    case 'media-control': return { ...base, label: '音乐控制', displayMode: 'always', showCover: true, showProgress: true } as unknown as EditorWidget;
    case 'system-monitor': return { ...base, label: '系统监控', showCPU: true, showMemory: true, showDisk: true, showNetwork: true, refreshInterval: 2 } as unknown as EditorWidget;
    case 'quick-action': return { ...base, label: '快捷面板', columns: 2, rows: 2, cells: [
      { type: 'launcher', name: '计算器', path: 'calc' },
      { type: 'launcher', name: '记事本', path: 'notepad' },
      { type: 'snippet', title: '欢迎语', snippets: [{ id: 's1', label: '您好', content: '您好，欢迎咨询！' }] },
      { type: 'snippet', title: '结束语', snippets: [{ id: 's2', label: '感谢', content: '感谢您的咨询！' }] },
    ] } as unknown as EditorWidget;
    case 'launcher': return { ...base, label: '应用启动', name: '计算器', path: 'calc', icon: '📱' } as unknown as EditorWidget;
    case 'clock': return { ...base, label: '时钟', format24h: true, showSeconds: true, showAmpm: true, showWeekday: false, clockDisplay: 'digital' } as unknown as EditorWidget;
    case 'date': return { ...base, label: '日期', dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true } as unknown as EditorWidget;
    case 'calendar': return { ...base, label: '日历', viewMode: 'month', highlightToday: true, gridW: 2, gridH: 3 } as unknown as EditorWidget;
    case 'card': return { ...base, label: '', cardTitle: '', cardDesc: '卡片描述', cardImage: '', cardImagePosition: 'top', cardTags: [], cardFooter: '' } as unknown as EditorWidget;
    case 'battery': return { ...base, label: '电池', batteryStyle: 'bar', showLevel: true, showCharging: true, showTemp: false, barColor: '#52c41a', lowColor: '#ff4d4f', lowThreshold: 20, dataSource: 'system.battery.level' } as unknown as EditorWidget;
    case 'weather': return { ...base, type: 'weather', label: '天气', url: '', showScrollbar: true, backgroundColor: '#ffffff', displayMode: 'webpage', rssUrl: '', jsonUrl: '', refreshInterval: 0, titleField: 'title', descField: 'description', timeField: 'pubDate', linkField: 'link', preset: 'weather', bilibiliRoomId: '', city: '', apiKey: '', unit: 'c', refreshHours: 1, requestMethod: 'GET', requestUrl: 'https://api.pynen.com/api/public/weather?q=${city}&f=wttr', requestHeaders: {}, extraParams: {}, responseMapping: { city: 'nearest_area[0].areaName[0].value', temp: 'current_condition[0].temp_C', condition: 'current_condition[0].weatherDesc[0].value', description: 'current_condition[0].weatherDesc[0].value', icon: 'current_condition[0].weatherCode', humidity: 'current_condition[0].humidity', wind_speed: 'current_condition[0].windspeedKmph', feels_like: 'current_condition[0].FeelsLikeC', forecast: 'weather' } } as unknown as EditorWidget;
    default: return base as unknown as EditorWidget;
  }
}

export function nextFree(widgets: EditorWidget[], cols: number, rows: number): [number, number] {
  const occ = new Set(widgets.map(w => `${w.gridCol},${w.gridRow}`));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!occ.has(`${c},${r}`)) return [c, r];
  return [0, widgets.length % rows];
}

// ─── Conversion: ThemeMeta → EditorTheme ─────────────────

export function themeToEditor(t: ThemeMeta): EditorTheme {
  return {
    id: t.id, name: t.name, version: t.version, author: t.author, description: t.description,
    source: t.source, market_id: t.market_id, downloaded_at: t.downloaded_at,
    orientation: t.orientation,
    pages: t.pages.map(p => ({
      id: p.id, label: p.label,
      layoutMode: (p.layout.type === 'free' ? 'free' : 'grid') as 'grid' | 'free',
      columns: p.layout.columns ?? 4, rows: p.layout.rows ?? 6,
      backgroundColor: (p.layout as unknown as Record<string, unknown>).backgroundColor as string | undefined,
      backgroundImage: (p.layout as unknown as Record<string, unknown>).backgroundImage as string | undefined,
      // transport 'tile' → editor 'repeat', same semantics (tiled)
      backgroundMode: ((p.layout as unknown as Record<string, unknown>).backgroundMode === 'tile'
        ? 'repeat'
        : (p.layout as unknown as Record<string, unknown>).backgroundMode) as EditorPage['backgroundMode'],
      backgroundOpacity: (p.layout as unknown as Record<string, unknown>).backgroundOpacity as number | undefined,
      widgets: p.widgets.map(w => ({
        id: w.id, type: w.type, label: w.label,
        gridCol: w.gridCol ?? 0, gridRow: w.gridRow ?? 0, gridW: w.gridW ?? 1, gridH: w.gridH ?? 1,
        freeX: (w as Record<string, unknown>).freeX as number ?? 10,
        freeY: (w as Record<string, unknown>).freeY as number ?? 10,
        freeW: (w as Record<string, unknown>).freeW as number ?? 30,
        freeH: (w as Record<string, unknown>).freeH as number ?? 15,
        borderRadius: (w as Record<string, unknown>).borderRadius as number | undefined,
        gaugeStyle: (w as Record<string, unknown>).gaugeStyle as 'ring' | 'number' | 'bar' | undefined,
        ...Object.fromEntries(Object.entries(w).filter(([k]) => !['id','type','label','gridCol','gridRow','gridW','gridH'].includes(k))),
      })),
    })),
  };
}

// keep AI-written / hand-typed widget fields inside sane bounds; grid spans are
// clamped against the page so nothing saves with a span that runs off the screen
export function sanitizeWidget<T extends { type: string; ringWidth?: number; gridCol?: number; gridRow?: number; gridW?: number; gridH?: number }>(w: T, page?: { columns?: number; rows?: number }): T {
  const out = { ...w };
  if (out.type === 'gauge' && out.ringWidth != null) {
    out.ringWidth = Math.max(1, Math.min(Math.round(Number(out.ringWidth)) || 1, 6));
  }
  if (page) {
    const cols = page.columns || 4;
    const rows = page.rows || 6;
    const col = Math.max(0, Math.min(out.gridCol ?? 0, cols - 1));
    const row = Math.max(0, Math.min(out.gridRow ?? 0, rows - 1));
    out.gridCol = col;
    out.gridRow = row;
    out.gridW = Math.max(1, Math.min(out.gridW ?? 1, cols - col));
    out.gridH = Math.max(1, Math.min(out.gridH ?? 1, rows - row));
  } else {
    if (out.gridCol != null) out.gridCol = Math.max(0, out.gridCol);
    if (out.gridRow != null) out.gridRow = Math.max(0, out.gridRow);
    if (out.gridW != null) out.gridW = Math.max(1, out.gridW);
    if (out.gridH != null) out.gridH = Math.max(1, out.gridH);
  }
  return out;
}

export function editorToThemeMeta(t: EditorTheme): ThemeMeta {
  return {
    id: t.id, name: t.name, version: t.version, author: t.author, description: t.description,
    source: t.source, market_id: t.market_id, downloaded_at: t.downloaded_at,
    orientation: t.orientation,
    pages: t.pages.map(p => ({
      id: p.id, label: p.label,
      layout: {
        type: p.layoutMode,
        columns: p.columns, rows: p.rows,
        backgroundColor: p.backgroundColor,
        backgroundImage: p.backgroundImage,
        // editor uses 'repeat', transport/mobile uses 'tile': normalize on export so the phone understands it
        backgroundMode: (p.backgroundMode === 'repeat' ? 'tile' : p.backgroundMode) as PageDefinition['layout']['backgroundMode'],
        backgroundOpacity: p.backgroundOpacity,
      } as PageDefinition['layout'],
      widgets: p.widgets.map(w => sanitizeWidget(w, p) as unknown as WidgetDefinition),
    })),
  };
}

// ─── Store ───────────────────────────────────────────────

export interface EditorState {
  theme: EditorTheme;
  activePageIdx: number;
  selectedWidgetId: string | null;
  orientation: 'portrait' | 'landscape';
  zoom: number;
  saving: boolean;
  exporting: boolean;
  snapX: boolean;
  snapY: boolean;

  loadTheme: (t: ThemeMeta) => void;
  initNewTheme: () => void;
  replaceTheme: (t: EditorTheme) => void;
  setThemeName: (name: string) => void;
  setActivePage: (idx: number) => void;
  selectWidget: (id: string | null) => void;
  toggleOrientation: () => void;
  setZoom: (z: number) => void;
  setSaving: (v: boolean) => void;
  setExporting: (v: boolean) => void;
  setSnapLines: (x: boolean, y: boolean) => void;

  // history stacks
  undoStack: EditorTheme[];
  redoStack: EditorTheme[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  // for AI: reset history (clear stacks) and push a snapshot
  resetHistory: (initial: EditorTheme) => void;

  // version history
  versionHistory: ThemeVersion[];
  currentVersionIdx: number;
  saveVersion: (changelog?: string) => void;
  rollbackToVersion: (idx: number) => void;
  loadVersionHistory: (themeId: string) => void;

  addPage: (label: string, layoutMode: 'grid' | 'free') => void;
  addPageFromTemplate: (page: EditorPage) => void;
  removePage: (idx: number) => void;
  reorderPages: (o: number, n: number) => void;
  updatePage: (idx: number, updates: Partial<EditorPage>) => void;

  addWidget: (type: string) => void;
  addWidgetAt: (type: string, col: number, row: number) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, col: number, row: number) => void;
  resizeWidget: (id: string, w: number, h: number) => void;
  moveWidgetFree: (id: string, x: number, y: number) => void;
  resizeWidgetFree: (id: string, w: number, h: number) => void;
  updateWidget: (id: string, values: Record<string, unknown>) => void;
  // z-order
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  // for AI: push an undo snapshot
  pushUndoSnapshot: (snapshot: EditorTheme) => void;
}

const EMPTY: EditorTheme = {
  id: '', name: '', version: '1.0.0', author: '', description: '',
  pages: [{ id: 'page-default', label: '主页', layoutMode: 'grid', columns: 4, rows: 6, widgets: [] }],
};

const wp = (s: EditorState) => s.theme.pages[s.activePageIdx];

export const useEditorStore = create<EditorState>((set, get) => ({
  theme: EMPTY, activePageIdx: 0, selectedWidgetId: null,
  orientation: 'landscape', zoom: 100, saving: false, exporting: false, snapX: false, snapY: false,
  undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  versionHistory: [], currentVersionIdx: -1,

  loadTheme: (t) => {
    const themeId = t.id;
    set({ theme: themeToEditor(t), activePageIdx: 0, selectedWidgetId: null, undoStack: [], redoStack: [], canUndo: false, canRedo: false });
    get().loadVersionHistory(themeId);
  },
  replaceTheme: (t) => {
    const themeId = t.id;
    // after a full replace: clear selection and clamp the active page (AI generation may return fewer
    // pages; a stale out-of-range idx leaves a blank canvas that "looks like nothing happened")
    const activePageIdx = Math.min(
      Math.max(t.pages.length - 1, 0),
      Math.max(get().activePageIdx, 0),
    );
    set({
      theme: t, activePageIdx, selectedWidgetId: null,
      undoStack: [], redoStack: [], canUndo: false, canRedo: false,
    });
    get().loadVersionHistory(themeId);
  },
  setThemeName: (name) => set(s => ({ theme: { ...s.theme, name } })),
  initNewTheme: () => {
    const newTheme = { id: genId('theme'), name: '新主题包', version: '1.0.0', author: '', description: '', source: 'local', pages: [{ ...EMPTY.pages[0], id: genId('page') }] };
    set({
      theme: newTheme,
      activePageIdx: 0, selectedWidgetId: null, undoStack: [], redoStack: [], canUndo: false, canRedo: false,
      versionHistory: [], currentVersionIdx: -1,
    });
  },
  setActivePage: (idx) => set({ activePageIdx: idx, selectedWidgetId: null }),
  selectWidget: (id) => set({ selectedWidgetId: id }),
  toggleOrientation: () => set(s => {
    const next: 'portrait' | 'landscape' = s.orientation === 'portrait' ? 'landscape' : 'portrait';
    // write orientation into theme.orientation too so save/export/AI set_orientation all persist it
    return { orientation: next, theme: { ...s.theme, orientation: next } };
  }),
  setZoom: (z) => set({ zoom: Math.min(150, Math.max(50, z)) }),
  setSaving: (v) => set({ saving: v }),
  setExporting: (v) => set({ exporting: v }),
  setSnapLines: (x, y) => set({ snapX: x, snapY: y }),

  undo: () => {
    const s = get();
    if (s.undoStack.length === 0) return;
    const prev = s.undoStack[s.undoStack.length - 1];
    const newUndo = s.undoStack.slice(0, -1);
    set({
      theme: prev,
      undoStack: newUndo,
      redoStack: [...s.redoStack, s.theme].slice(-50),
      canUndo: newUndo.length > 0,
      canRedo: true,
      selectedWidgetId: null,
    });
  },
  redo: () => {
    const s = get();
    if (s.redoStack.length === 0) return;
    const next = s.redoStack[s.redoStack.length - 1];
    const newRedo = s.redoStack.slice(0, -1);
    set({
      theme: next,
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: newRedo,
      canUndo: true,
      canRedo: newRedo.length > 0,
      selectedWidgetId: null,
    });
  },
  clearHistory: () => set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false }),
  resetHistory: (initial) => set({ theme: initial, undoStack: [], redoStack: [], canUndo: false, canRedo: false }),

  // ─── version history ────────────────────────────────────

  saveVersion: (changelog?) => {
    const s = get();
    const meta = editorToThemeMeta(s.theme);
    // skip snapshots carrying too much base64 (>100KB)
    const snapshot = JSON.parse(JSON.stringify(meta));
    const size = new Blob([JSON.stringify(snapshot)]).size;
    if (size > 100_000) {
      console.warn(`[VersionHistory] Snapshot too large (${(size / 1024).toFixed(1)}KB), skipping`);
      return;
    }
    const ver: ThemeVersion = {
      version: meta.version || '1.0.0',
      timestamp: new Date().toISOString(),
      changelog,
      snapshot,
    };
    const history = [...s.versionHistory, ver].slice(-20);
    const idx = history.length - 1;
    set({ versionHistory: history, currentVersionIdx: idx });
    // persist to localStorage (quota errors swallowed)
    if (s.theme.id) {
      try {
        localStorage.setItem(`ilinkcat_version_history_${s.theme.id}`, JSON.stringify(history));
      } catch (e) {
        console.warn('[VersionHistory] Failed to persist:', e);
      }
    }
  },
  rollbackToVersion: (idx) => {
    const s = get();
    const hist = s.versionHistory;
    if (idx < 0 || idx >= hist.length) return;
    const ver = hist[idx];
    if (ver) {
      const editorTheme = themeToEditor(ver.snapshot);
      set({
        theme: editorTheme,
        selectedWidgetId: null,
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        currentVersionIdx: idx,
      });
    }
  },
  loadVersionHistory: (themeId) => {
    try {
      const raw = localStorage.getItem(`ilinkcat_version_history_${themeId}`);
      if (raw) {
        const history: ThemeVersion[] = JSON.parse(raw);
        set({ versionHistory: history, currentVersionIdx: history.length - 1 });
      } else {
        set({ versionHistory: [], currentVersionIdx: -1 });
      }
    } catch {
      set({ versionHistory: [], currentVersionIdx: -1 });
    }
  },

  addPage: (label, layoutMode) => set(s => {
    const pg: EditorPage = { id: genId('page'), label, layoutMode, columns: 4, rows: 6, widgets: [] };
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: [...s.theme.pages, pg] }, activePageIdx: s.theme.pages.length, selectedWidgetId: null,
    };
  }),
  addPageFromTemplate: (page) => set(s => {
    const pg: EditorPage = { ...page, id: genId('page') };
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: [...s.theme.pages, pg] }, activePageIdx: s.theme.pages.length, selectedWidgetId: null,
    };
  }),
  removePage: (idx) => set(s => {
    const pages = s.theme.pages.filter((_, i) => i !== idx);
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages }, activePageIdx: Math.min(s.activePageIdx, Math.max(0, pages.length - 1)), selectedWidgetId: null,
    };
  }),
  reorderPages: (o, n) => set(s => {
    const pages = [...s.theme.pages]; const [m] = pages.splice(o, 1); pages.splice(n, 0, m);
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages }, activePageIdx: n,
    };
  }),
  updatePage: (idx, updates) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === idx ? { ...p, ...updates } : p) },
  })),

  addWidget: (type) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const [c, r] = nextFree(pg.widgets, pg.columns, pg.rows);
    const w = makeWidget(type, c, r);
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: [...p.widgets, w] } : p) }, selectedWidgetId: w.id,
    };
  }),
  addWidgetAt: (type, col, row) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const w = makeWidget(type, col, row);
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: [...p.widgets, w] } : p) }, selectedWidgetId: w.id,
    };
  }),
  removeWidget: (id) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.filter(w => w.id !== id) } : p) },
    selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
  })),
  moveWidget: (id, col, row) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, gridCol: col, gridRow: row } : w) } : p) },
  })),
  resizeWidget: (id, w, h) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(ww => ww.id === id ? { ...ww, gridW: w, gridH: h } : ww) } : p) },
  })),
  moveWidgetFree: (id, x, y) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, freeX: x, freeY: y } : w) } : p) },
  })),
  resizeWidgetFree: (id, w, h) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(ww => ww.id === id ? { ...ww, freeW: w, freeH: h } : ww) } : p) },
  })),
  updateWidget: (id, values) => set(s => ({
    undoStack: [...s.undoStack, s.theme].slice(-50),
    redoStack: [], canUndo: true, canRedo: false,
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? sanitizeWidget({ ...w, ...values }) : w) } : p) },
  })),

  // ─── z-order ────────────────────────────────────────────

  bringToFront: (id) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const widgets = pg.widgets;
    const maxZ = Math.max(0, ...widgets.map(w => (w.zIndex ?? 0)));
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, zIndex: maxZ + 1 } : w) } : p) },
    };
  }),
  sendToBack: (id) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const widgets = pg.widgets;
    const minZ = Math.min(0, ...widgets.map(w => (w.zIndex ?? 0)));
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, zIndex: minZ - 1 } : w) } : p) },
    };
  }),
  moveUp: (id) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const widgets = pg.widgets;
    const sorted = [...widgets].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = sorted.findIndex(w => w.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return s;
    const current = sorted[idx];
    const above = sorted[idx + 1];
    const currentZ = current.zIndex ?? 0;
    const aboveZ = above.zIndex ?? 0;
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => {
        if (w.id === id) return { ...w, zIndex: aboveZ };
        if (w.id === above.id) return { ...w, zIndex: currentZ };
        return w;
      }) } : p) },
    };
  }),
  moveDown: (id) => set(s => {
    const pg = wp(s); if (!pg) return s;
    const widgets = pg.widgets;
    const sorted = [...widgets].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = sorted.findIndex(w => w.id === id);
    if (idx <= 0) return s;
    const current = sorted[idx];
    const below = sorted[idx - 1];
    const currentZ = current.zIndex ?? 0;
    const belowZ = below.zIndex ?? 0;
    return {
      undoStack: [...s.undoStack, s.theme].slice(-50),
      redoStack: [], canUndo: true, canRedo: false,
      theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => {
        if (w.id === id) return { ...w, zIndex: belowZ };
        if (w.id === below.id) return { ...w, zIndex: currentZ };
        return w;
      }) } : p) },
    };
  }),

  // ─── undo snapshots (for AI) ────────────────────────────

  pushUndoSnapshot: (snapshot) => set(s => ({
    undoStack: [...s.undoStack, snapshot].slice(-50),
    redoStack: [],
    canUndo: true,
    canRedo: false,
  })),
}));
