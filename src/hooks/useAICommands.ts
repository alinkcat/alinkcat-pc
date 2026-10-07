import { useEditorStore } from '../pages/Editor/store/editorStore';
import { useAIStore } from '../store/aiStore';
import type { AIInstruction } from '../types/ai';

const TYPE_MAP: Record<string, string> = {
  'sticky-note': 'snippet-list',
  stickyNote: 'snippet-list',
  'quick-action': 'button',
  'text-label': 'text',
  textLabel: 'text',
  systemMonitor: 'system-monitor',
  mediaControl: 'media-control',
};

/** normalize widget types the AI might emit (camelCase/underscores/spaces → kebab-case) */
export function normalizeWidgetType(t: string): string {
  const s = String(t || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  return s;
}

export function mapWidgetType(t: string): string {
  return TYPE_MAP[t] || normalizeWidgetType(t) || t;
}

/** resolve image refs from AI output (e.g. "图1") into actual data URLs */
function resolveImageRef(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const imgs = useAIStore.getState().droppedImages;
  // matches "图1" / "图 1" style refs
  const match = value.match(/^图\s*(\d+)$/);
  if (match) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < imgs.length) return imgs[idx].dataUrl;
  }
  const byName = imgs.find((d) => d.fileName === value || d.name === value);
  if (byName) return byName.dataUrl;
  return value;
}

/** fix up image refs in widget props */
function resolveWidgetValues(w: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(w)) {
    if (k === 'type') { out[k] = v; continue; }
    if (k === 'src' || k === 'icon' || k === 'backgroundImage') {
      out[k] = resolveImageRef(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** clamp pageIndex into range; undefined means "current page" */
function clampPageIdx(idx: unknown): number | undefined {
  if (idx === undefined || idx === null) return undefined;
  const n = Math.floor(Number(idx));
  if (Number.isNaN(n)) return undefined;
  const len = useEditorStore.getState().theme.pages.length;
  if (len === 0) return 0;
  return Math.min(Math.max(n, 0), len - 1);
}

/** raw instruction object → AIInstruction */
function toInstruction(obj: Record<string, unknown>): AIInstruction | null {
  if (!obj || typeof obj !== 'object' || !obj.type) return null;
  const type = String(obj.type);
  const isDanger = type === 'generate_full_theme' || type === 'replace_theme' || type === 'batch';
  return {
    id: `instr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: type as AIInstruction['type'],
    pageIndex: clampPageIdx(obj.pageIndex) as number | undefined,
    widget: obj.widget as Record<string, unknown> | undefined,
    params: obj.params as Record<string, unknown> | undefined,
    theme: obj.theme as Record<string, unknown> | undefined,
    executed: false,
    confirmed: false,
    severity: isDanger ? 'danger' : 'normal',
  };
}

/** dig JSON blocks out of arbitrary text:
 *  1) ```json / ```JSON / ```javascript fences
 *  2) any ``` fence with no language tag
 *  3) no fence: balanced block from the first { or [ (AI occasionally emits raw JSON) */
function findJsonBlocks(text: string): unknown[] {
  const blocks: unknown[] = [];
  const push = (s: string) => {
    if (!s || s.length > 400_000) return;
    try { blocks.push(JSON.parse(s)); } catch { /* not JSON or truncated */ }
  };

  // 1) language-tagged fences (case-insensitive)
  const langRe = /```(?:json|javascript|js)\s*\n?([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  let matchedAny = false;
  while ((m = langRe.exec(text)) !== null) { matchedAny = true; push(m[1]); }
  // 2) any fence, only when nothing above matched so we don't swallow unrelated code blocks
  if (!matchedAny) {
    const fenceRe = /```[^\n]*\n?([\s\S]*?)```/g;
    while ((m = fenceRe.exec(text)) !== null) push(m[1]);
  }
  // 3) bare JSON, only blocks containing a "type" key
  if (blocks.length === 0) {
    const probe = text.match(/\{\s*"type"\s*:|\[\s*\{\s*"type"\s*:/);
    if (probe) {
      const start = probe.index!;
      const openCh = text[start];
      const closeCh = openCh === '{' ? '}' : ']';
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === '\\') esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === openCh) depth++;
        else if (ch === closeCh && --depth === 0) {
          push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

/**
 * pull instruction blocks out of AI reply text.
 * shapes seen in practice (prompt asks full-page generation to return an array, other instructions are objects):
 *   [{ "type": "generate_full_theme", "theme": {...} }]   ← array wrapper
 *   { "type": "add_widget", "widget": {...} }              ← single object
 *   { "type": "batch", "params": { "actions": [...] } }    ← nested batch
 */
export function parseInstructions(text: string): AIInstruction[] {
  const results: AIInstruction[] = [];
  for (const parsed of findJsonBlocks(text)) {
    if (Array.isArray(parsed)) {
      // array shape: parse one by one (generate_full_theme returns [{...}])
      for (const item of parsed) {
        const instr = toInstruction(item as Record<string, unknown>);
        if (instr) results.push(instr);
      }
    } else if (parsed && typeof parsed === 'object') {
      const instr = toInstruction(parsed as Record<string, unknown>);
      if (instr) results.push(instr);
    }
  }
  // dedupe: the same JSON can hit multiple shapes, keep one
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.type}|${r.pageIndex ?? '-'}|${JSON.stringify(r.widget ?? r.params ?? r.theme ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** find a widget on the current page by label */
function findWidgetByLabel(label: string) {
  const st = useEditorStore.getState();
  const pg = st.theme.pages[st.activePageIdx];
  return pg?.widgets.find((w) => w.label === label);
}

export interface ExecResult { ok: boolean; error?: string }

/** run a single instruction; returns ok flag + human-readable error */
export function executeInstruction(instr: AIInstruction): ExecResult {
  const st = useEditorStore.getState();

  try {
    switch (instr.type) {
      // ─── add widget ────────────────────────────────
      case 'add_widget': {
        const pageIdx = instr.pageIndex ?? st.activePageIdx;
        const page = st.theme.pages[pageIdx];
        if (!page) return { ok: false, error: '目标页面不存在，无法添加控件' };
        const beforeCount = page.widgets.length;
        if (instr.pageIndex !== undefined) st.setActivePage(pageIdx);
        const w = resolveWidgetValues(instr.widget || {});
        const type = mapWidgetType(String(w.type || 'button'));
        st.addWidget(type);
        const wid = st.selectedWidgetId;
        if (wid) {
          const values: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(w)) {
            if (k === 'type') continue;
            values[k] = v;
          }
          st.updateWidget(wid, values);
        }
        const afterCount = st.theme.pages[pageIdx]?.widgets.length ?? 0;
        if (afterCount <= beforeCount) return { ok: false, error: `控件添加失败（未知类型 "${type}"？）` };
        return { ok: true };
      }
      // ─── delete widget ─────────────────────────────
      case 'delete_widget': {
        const p = instr.params || {};
        if (p.widgetId) { st.removeWidget(String(p.widgetId)); return { ok: true }; }
        if (p.label) {
          const w = findWidgetByLabel(String(p.label));
          if (w) { st.removeWidget(w.id); return { ok: true }; }
          return { ok: false, error: `未找到标签为 "${p.label}" 的控件` };
        }
        return { ok: false, error: '缺少控件 ID 或标签' };
      }
      // ─── update props ──────────────────────────────
      case 'update_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return { ok: false, error: '未选中控件且未指定 widgetId' };
        const { widgetId: _wid, ...fields } = p;
        const resolved = resolveWidgetValues(fields as Record<string, unknown>);
        st.updateWidget(widgetId, resolved);
        return { ok: true };
      }
      // ─── duplicate widget ──────────────────────────
      case 'duplicate_widget': {
        const p = instr.params || {};
        let srcId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!srcId) return { ok: false, error: '未选中控件且未指定 widgetId' };
        const pg = st.theme.pages[st.activePageIdx];
        const src = pg?.widgets.find((w) => w.id === srcId);
        if (!src) return { ok: false, error: '源控件不存在' };
        st.addWidget(src.type);
        const newId = st.selectedWidgetId;
        if (newId) {
          const values: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(src)) {
            if (k === 'id' || k === 'type') continue;
            values[k] = v;
          }
          st.updateWidget(newId, values);
        }
        return { ok: true };
      }
      // ─── move ──────────────────────────────────────
      case 'move_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return { ok: false, error: '未选中控件且未指定 widgetId' };
        if (p.gridCol !== undefined && p.gridRow !== undefined) {
          st.moveWidget(widgetId, Number(p.gridCol), Number(p.gridRow));
        } else if (p.freeX !== undefined && p.freeY !== undefined) {
          st.moveWidgetFree(widgetId, Number(p.freeX), Number(p.freeY));
        } else {
          return { ok: false, error: '缺少目标位置参数（gridCol/gridRow 或 freeX/freeY）' };
        }
        return { ok: true };
      }
      // ─── resize ────────────────────────────────────
      case 'resize_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return { ok: false, error: '未选中控件且未指定 widgetId' };
        if (p.gridW !== undefined && p.gridH !== undefined) {
          st.resizeWidget(widgetId, Number(p.gridW), Number(p.gridH));
        } else if (p.freeW !== undefined && p.freeH !== undefined) {
          st.resizeWidgetFree(widgetId, Number(p.freeW), Number(p.freeH));
        } else {
          return { ok: false, error: '缺少尺寸参数（gridW/gridH 或 freeW/freeH）' };
        }
        return { ok: true };
      }
      // ─── add page ──────────────────────────────────
      case 'add_page': {
        const p = instr.params || {};
        st.addPage(String(p.label || '新页面'), p.layoutMode === 'free' ? 'free' : 'grid');
        return { ok: true };
      }
      // ─── delete page ───────────────────────────────
      case 'delete_page': {
        const p = instr.params || {};
        const idx = clampPageIdx(p.pageIndex) ?? st.activePageIdx;
        if (st.theme.pages[idx]) { st.removePage(idx); return { ok: true }; }
        return { ok: false, error: `页面 ${idx} 不存在` };
      }
      // ─── reorder pages ─────────────────────────────
      case 'reorder_pages': {
        const p = instr.params || {};
        const oldIdx = clampPageIdx(p.oldIndex);
        const newIdx = clampPageIdx(p.newIndex);
        if (oldIdx !== undefined && newIdx !== undefined && st.theme.pages[oldIdx] && st.theme.pages[newIdx]) {
          st.reorderPages(oldIdx, newIdx);
          return { ok: true };
        }
        return { ok: false, error: '页面排序参数无效' };
      }
      // ─── layout ────────────────────────────────────
      case 'change_layout': {
        const p = instr.params || {};
        const idx = clampPageIdx(p.pageIndex) ?? st.activePageIdx;
        if (!st.theme.pages[idx]) return { ok: false, error: `页面 ${idx} 不存在` };
        const updates: Record<string, unknown> = {};
        if (p.layoutMode) updates.layoutMode = p.layoutMode === 'free' ? 'free' : 'grid';
        if (p.columns) updates.columns = Math.max(1, Math.min(Number(p.columns), 20));
        if (p.rows) updates.rows = Math.max(1, Math.min(Number(p.rows), 20));
        st.updatePage(idx, updates);
        return { ok: true };
      }
      // ─── background ────────────────────────────────
      case 'set_background': {
        const p = instr.params || {};
        const idx = clampPageIdx(p.pageIndex) ?? st.activePageIdx;
        if (!st.theme.pages[idx]) return { ok: false, error: `页面 ${idx} 不存在` };
        const updates: Record<string, unknown> = {};
        if (p.backgroundColor) updates.backgroundColor = p.backgroundColor;
        if (p.backgroundImage) updates.backgroundImage = resolveImageRef(p.backgroundImage);
        if (p.backgroundMode) updates.backgroundMode = p.backgroundMode;
        st.updatePage(idx, updates);
        return { ok: true };
      }
      // ─── orientation ───────────────────────────────
      case 'set_orientation': {
        const p = instr.params || {};
        const o = String(p.orientation || 'landscape');
        if (o === 'portrait' || o === 'landscape') {
          const cur = useEditorStore.getState().orientation;
          if (cur !== o) useEditorStore.getState().toggleOrientation();
          else if (useEditorStore.getState().theme.orientation !== o) {
            // orientation matches but theme.orientation was never synced (old packs): fix it up
            const st = useEditorStore.getState();
            st.replaceTheme({ ...st.theme, orientation: o });
          }
          return { ok: true };
        }
        return { ok: false, error: `无效方向 "${o}"` };
      }
      // ─── theme meta ────────────────────────────────
      case 'set_theme_meta': {
        const p = instr.params || {};
        const updates: Record<string, unknown> = {};
        if (p.name) updates.name = p.name;
        if (p.author) updates.author = p.author;
        if (p.version) updates.version = p.version;
        if (p.description) updates.description = p.description;
        const cur = useEditorStore.getState();
        cur.replaceTheme({ ...cur.theme, ...updates });
        return { ok: true };
      }
      // ─── batch ─────────────────────────────────────
      case 'batch': {
        const p = instr.params || {};
        const actions = Array.isArray(p.actions) ? p.actions : [];
        if (actions.length === 0) return { ok: false, error: 'batch 缺少 actions' };
        let firstErr: string | undefined;
        for (const a of actions) {
          const sub: AIInstruction = {
            ...a, id: `instr-${Math.random().toString(36).slice(2, 8)}`,
            executed: false, confirmed: false,
          };
          // child pageIndex needs clamping too (AI loves absolute pageIndexes in sub-actions)
          const r = executeInstruction({ ...sub, pageIndex: clampPageIdx(sub.pageIndex) });
          if (!r.ok && !firstErr) firstErr = r.error;
        }
        return firstErr ? { ok: false, error: firstErr } : { ok: true };
      }
      // ─── full-page generation ──────────────────────
      case 'generate_full_theme': {
        const theme = instr.theme;
        if (!theme) return { ok: false, error: '缺少 theme 数据' };
        // generate unique ids for pages/widgets when missing
        if (Array.isArray(theme.pages)) {
          theme.pages = theme.pages.map((page: Record<string, unknown>) => {
            if (!page.id) page.id = `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
            if (Array.isArray(page.widgets)) {
              page.widgets = page.widgets.map((w: Record<string, unknown>) => {
                if (!w.id) w.id = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
                return w;
              });
            }
            return page;
          });
        } else {
          return { ok: false, error: 'theme.pages 缺失或不是数组' };
        }
        if (!theme.id) theme.id = `theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        if (!theme.version) theme.version = '1.0.0';
        if (!theme.author) theme.author = '';
        st.replaceTheme(theme as unknown as import('../pages/Editor/types').EditorTheme);
        return { ok: true };
      }
      default:
        return { ok: false, error: `未知指令类型 "${instr.type}"` };
    }
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e) };
  }
}

/** run a batch of instructions with an undo snapshot; returns ok count, total and errors */
export function runInstructions(instrs: AIInstruction[]): { ok: number; total: number; errors: string[] } {
  if (instrs.length === 0) return { ok: 0, total: 0, errors: [] };
  const snapshot = useEditorStore.getState().theme;

  let ok = 0;
  const errors: string[] = [];
  for (const instr of instrs) {
    const r = executeInstruction(instr);
    if (r.ok) ok++;
    else if (r.error) errors.push(r.error);
    instr.executed = true;
    if (!r.ok) {
      instr.failed = true;
      instr.error = r.error;
    }
  }

  // push the pre-execution snapshot onto the editor undo stack (stacks with the store's per-step snapshots)
  useEditorStore.getState().pushUndoSnapshot(snapshot);

  return { ok, total: instrs.length, errors };
}

const TYPE_DESC_KEY: Record<string, string> = {
  add_widget: 'instrTypeAddWidget',
  delete_widget: 'instrTypeDeleteWidget',
  update_widget: 'instrTypeUpdateWidget',
  duplicate_widget: 'instrTypeDuplicateWidget',
  move_widget: 'instrTypeMoveWidget',
  resize_widget: 'instrTypeResizeWidget',
  add_page: 'instrTypeAddPage',
  delete_page: 'instrTypeDeletePage',
  reorder_pages: 'instrTypeReorderPages',
  change_layout: 'instrTypeChangeLayout',
  set_background: 'instrTypeSetBackground',
  set_orientation: 'instrTypeSetOrientation',
  set_theme_meta: 'instrTypeSetThemeMeta',
  batch: 'instrTypeBatch',
  generate_full_theme: 'instrTypeGenerateTheme',
};

/** i18n key per instruction type, for human-readable list descriptions */
export function instrTypeKey(type: string): string {
  return TYPE_DESC_KEY[type] || 'instrTypeUnknown';
}
