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
    freeX: 10, freeY: 10, freeW: 30, freeH: 15,
    backgroundColor: '#f0f2f5',
    backgroundOpacity: 100,
    textColor: '#333333',
    fontSize: 12,
    fontWeight: 'normal',
    borderRadius: 6,
  };
  switch (type) {
    case 'button': return { ...base, icon: '🔘', action: { type: 'keyboard', keys: [] } } as EditorWidget;
    case 'gauge': return { ...base, dataSource: 'system.cpu.usage', unit: '%', gaugeStyle: 'ring', minValue: 0, maxValue: 100, ringColorLow: '#52c41a', ringColorMid: '#faad14', ringColorHigh: '#ff4d4f', ringWidth: 3 } as EditorWidget;
    case 'snippet-list': return { ...base, snippets: [], backgroundColor: '#fff9e6', mode: 'note' } as EditorWidget;
    case 'image': return { ...base, src: '', objectFit: 'cover' } as EditorWidget;
    case 'text': return { ...base, content: '双击编辑文字', fontSize: 16, fontWeight: 'normal', color: '#333333', textAlign: 'left', backgroundColor: 'transparent', backgroundOpacity: 0, padding: 4, borderRadius: 0 } as EditorWidget;
    case 'shape': return { ...base, shapeType: 'rect', fillType: 'solid', fillColor: '#d9d9d9', gradientStart: '#4F6EF7', gradientEnd: '#52c41a', gradientAngle: 90, borderColor: 'transparent', borderWidth: 0, borderRadius: 0, opacity: 100 } as EditorWidget;
    case 'webview': return { ...base, url: '', showScrollbar: true, backgroundColor: '#ffffff', displayMode: 'webpage', rssUrl: '', jsonUrl: '', refreshInterval: 0, titleField: 'title', descField: 'description', timeField: 'pubDate', linkField: 'link', preset: 'none', bilibiliRoomId: '', weatherCity: '', weatherApiKey: '', weatherUnit: 'c' } as EditorWidget;
    case 'media-control': return { ...base, label: '音乐控制', displayMode: 'always', showCover: true, showProgress: true } as EditorWidget;
    case 'system-monitor': return { ...base, label: '系统监控', showCPU: true, showMemory: true, showDisk: true, showNetwork: true, refreshInterval: 2 } as EditorWidget;
    case 'quick-action': return { ...base, label: '快捷面板', columns: 2, rows: 2, cells: [
      { type: 'launcher', name: '计算器', path: 'calc' },
      { type: 'launcher', name: '记事本', path: 'notepad' },
      { type: 'snippet', title: '欢迎语', snippets: [{ id: 's1', label: '您好', content: '您好，欢迎咨询！' }] },
      { type: 'snippet', title: '结束语', snippets: [{ id: 's2', label: '感谢', content: '感谢您的咨询！' }] },
    ] } as EditorWidget;
    case 'launcher': return { ...base, label: '应用启动', name: '计算器', path: 'calc', icon: '📱' } as EditorWidget;
    case 'clock': return { ...base, label: '时钟', format24h: true, showSeconds: true, showAmpm: true } as EditorWidget;
    case 'date': return { ...base, label: '日期', dateFormat: 'YYYY年MM月DD日 星期X', showLunar: true } as EditorWidget;
    case 'calendar': return { ...base, label: '日历', viewMode: 'month', highlightToday: true, gridW: 2, gridH: 3 } as EditorWidget;
    default: return base as EditorWidget;
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
    pages: t.pages.map(p => ({
      id: p.id, label: p.label,
      layoutMode: (p.layout.type === 'free' ? 'free' : 'grid') as 'grid' | 'free',
      columns: p.layout.columns ?? 4, rows: p.layout.rows ?? 6,
      backgroundColor: (p.layout as unknown as Record<string, unknown>).backgroundColor as string | undefined,
      backgroundImage: (p.layout as unknown as Record<string, unknown>).backgroundImage as string | undefined,
      backgroundMode: (p.layout as unknown as Record<string, unknown>).backgroundMode as EditorPage['backgroundMode'],
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

export function editorToThemeMeta(t: EditorTheme): ThemeMeta {
  return {
    id: t.id, name: t.name, version: t.version, author: t.author, description: t.description,
    source: t.source, market_id: t.market_id, downloaded_at: t.downloaded_at,
    pages: t.pages.map(p => ({
      id: p.id, label: p.label,
      layout: {
        type: p.layoutMode,
        columns: p.columns, rows: p.rows,
        backgroundColor: p.backgroundColor,
        backgroundImage: p.backgroundImage,
        backgroundMode: p.backgroundMode,
        backgroundOpacity: p.backgroundOpacity,
      } as PageDefinition['layout'],
      widgets: p.widgets as unknown as WidgetDefinition[],
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
  setActivePage: (idx: number) => void;
  selectWidget: (id: string | null) => void;
  toggleOrientation: () => void;
  setZoom: (z: number) => void;
  setSaving: (v: boolean) => void;
  setExporting: (v: boolean) => void;
  setSnapLines: (x: boolean, y: boolean) => void;

  // 历史栈
  undoStack: EditorTheme[];
  redoStack: EditorTheme[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  // 供 AI 调用：初始化历史（清空栈），压入快照
  resetHistory: (initial: EditorTheme) => void;

  // 版本历史
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
    // 加载版本历史
    get().loadVersionHistory(themeId);
  },
  replaceTheme: (t) => {
    const themeId = t.id;
    set({ theme: t, selectedWidgetId: null, undoStack: [], redoStack: [], canUndo: false, canRedo: false });
    get().loadVersionHistory(themeId);
  },
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
  toggleOrientation: () => set(s => ({ orientation: s.orientation === 'portrait' ? 'landscape' : 'portrait' })),
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

  // ─── 版本历史 ───────────────────────────────────────────

  saveVersion: (changelog?) => {
    const s = get();
    const meta = editorToThemeMeta(s.theme);
    const ver: ThemeVersion = {
      version: meta.version || '1.0.0',
      timestamp: new Date().toISOString(),
      changelog,
      snapshot: JSON.parse(JSON.stringify(meta)),
    };
    const history = [...s.versionHistory, ver].slice(-20);
    const idx = history.length - 1;
    set({ versionHistory: history, currentVersionIdx: idx });
    // 持久化到 localStorage
    if (s.theme.id) {
      localStorage.setItem(`ilinkcat_version_history_${s.theme.id}`, JSON.stringify(history));
    }
  },
  rollbackToVersion: (idx) => {
    const s = get();
    const hist = s.versionHistory;
    if (idx < 0 || idx >= hist.length) return;
    const ver = hist[idx];
    if (ver) {
      // 用快照替换编辑器状态
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
    theme: { ...s.theme, pages: s.theme.pages.map((p, i) => i === s.activePageIdx ? { ...p, widgets: p.widgets.map(w => w.id === id ? { ...w, ...values } : w) } : p) },
  })),
}));
