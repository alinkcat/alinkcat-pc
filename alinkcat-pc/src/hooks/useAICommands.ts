import { useEditorStore } from '../pages/Editor/store/editorStore';
import { useAIStore } from '../store/aiStore';
import type { AIInstruction } from '../types/ai';

const TYPE_MAP: Record<string, string> = {
  'sticky-note': 'snippet-list',
  stickyNote: 'snippet-list',
  'quick-action': 'button',
  'text-label': 'text',
};

export function mapWidgetType(t: string): string {
  return TYPE_MAP[t] || t;
}

/** 将 AI 输出的图片引用（如"图1"）解析为实际 data URL */
function resolveImageRef(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const imgs = useAIStore.getState().droppedImages;
  // 匹配 "图1"、"图2" 或 "图 1" 格式
  const match = value.match(/^图\s*(\d+)$/);
  if (match) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < imgs.length) return imgs[idx].dataUrl;
  }
  // 直接匹配文件名
  const byName = imgs.find((d) => d.fileName === value || d.name === value);
  if (byName) return byName.dataUrl;
  return value;
}

/** 修复 widget 属性中的图片引用 */
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

/** 从 AI 回复文本中提取 ```json ... ``` 指令块 */
export function parseInstructions(text: string): AIInstruction[] {
  const results: AIInstruction[] = [];
  const regex = /```json\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj && obj.type) {
        results.push({
          id: `instr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: obj.type,
          pageIndex: obj.pageIndex,
          widget: obj.widget,
          params: obj.params,
          executed: false,
          confirmed: false,
        });
      }
    } catch {
      // 跳过无法解析的块
    }
  }
  return results;
}

/** 根据 label 查找当前页面的控件 */
function findWidgetByLabel(label: string) {
  const st = useEditorStore.getState();
  const pg = st.theme.pages[st.activePageIdx];
  return pg?.widgets.find((w) => w.label === label);
}

/** 执行单条指令，返回是否成功 */
export function executeInstruction(instr: AIInstruction): boolean {
  const st = useEditorStore.getState();

  try {
    switch (instr.type) {
      // ─── 添加控件 ──────────────────────────────────
      case 'add_widget': {
        if (instr.pageIndex !== undefined) st.setActivePage(instr.pageIndex);
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
        return true;
      }
      // ─── 删除控件 ──────────────────────────────────
      case 'delete_widget': {
        const p = instr.params || {};
        if (p.widgetId) { st.removeWidget(String(p.widgetId)); return true; }
        if (p.label) {
          const w = findWidgetByLabel(String(p.label));
          if (w) { st.removeWidget(w.id); return true; }
        }
        return false;
      }
      // ─── 修改属性 ──────────────────────────────────
      case 'update_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return false;
        const { widgetId: _wid, ...fields } = p;
        const resolved = resolveWidgetValues(fields as Record<string, unknown>);
        st.updateWidget(widgetId, resolved);
        return true;
      }
      // ─── 复制控件 ──────────────────────────────────
      case 'duplicate_widget': {
        const p = instr.params || {};
        let srcId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!srcId) return false;
        const pg = st.theme.pages[st.activePageIdx];
        const src = pg?.widgets.find((w) => w.id === srcId);
        if (!src) return false;
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
        return true;
      }
      // ─── 移动位置 ──────────────────────────────────
      case 'move_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return false;
        if (p.gridCol !== undefined && p.gridRow !== undefined) {
          st.moveWidget(widgetId, Number(p.gridCol), Number(p.gridRow));
        } else if (p.freeX !== undefined && p.freeY !== undefined) {
          st.moveWidgetFree(widgetId, Number(p.freeX), Number(p.freeY));
        }
        return true;
      }
      // ─── 调整大小 ──────────────────────────────────
      case 'resize_widget': {
        const p = instr.params || {};
        const widgetId = p.widgetId ? String(p.widgetId) : st.selectedWidgetId;
        if (!widgetId) return false;
        if (p.gridW !== undefined && p.gridH !== undefined) {
          st.resizeWidget(widgetId, Number(p.gridW), Number(p.gridH));
        } else if (p.freeW !== undefined && p.freeH !== undefined) {
          st.resizeWidgetFree(widgetId, Number(p.freeW), Number(p.freeH));
        }
        return true;
      }
      // ─── 添加页面 ──────────────────────────────────
      case 'add_page': {
        const p = instr.params || {};
        st.addPage(String(p.label || '新页面'), p.layoutMode === 'free' ? 'free' : 'grid');
        return true;
      }
      // ─── 删除页面 ──────────────────────────────────
      case 'delete_page': {
        const p = instr.params || {};
        const idx = p.pageIndex !== undefined ? Number(p.pageIndex) : st.activePageIdx;
        if (st.theme.pages[idx]) { st.removePage(idx); return true; }
        return false;
      }
      // ─── 排序页面 ──────────────────────────────────
      case 'reorder_pages': {
        const p = instr.params || {};
        const oldIdx = Number(p.oldIndex);
        const newIdx = Number(p.newIndex);
        if (st.theme.pages[oldIdx] && st.theme.pages[newIdx]) {
          st.reorderPages(oldIdx, newIdx);
          return true;
        }
        return false;
      }
      // ─── 修改布局 ──────────────────────────────────
      case 'change_layout': {
        const p = instr.params || {};
        const idx = p.pageIndex !== undefined ? Number(p.pageIndex) : st.activePageIdx;
        const updates: Record<string, unknown> = {};
        if (p.layoutMode) updates.layoutMode = p.layoutMode === 'free' ? 'free' : 'grid';
        if (p.columns) updates.columns = Number(p.columns);
        if (p.rows) updates.rows = Number(p.rows);
        st.updatePage(idx, updates);
        return true;
      }
      // ─── 设置背景 ──────────────────────────────────
      case 'set_background': {
        const p = instr.params || {};
        const idx = p.pageIndex !== undefined ? Number(p.pageIndex) : st.activePageIdx;
        const updates: Record<string, unknown> = {};
        if (p.backgroundColor) updates.backgroundColor = p.backgroundColor;
        if (p.backgroundImage) updates.backgroundImage = resolveImageRef(p.backgroundImage);
        if (p.backgroundMode) updates.backgroundMode = p.backgroundMode;
        st.updatePage(idx, updates);
        return true;
      }
      // ─── 切换横竖屏 ────────────────────────────────
      case 'set_orientation': {
        const p = instr.params || {};
        const o = String(p.orientation || 'landscape');
        if (o === 'portrait' || o === 'landscape') {
          const cur = useEditorStore.getState().orientation;
          if (cur !== o) useEditorStore.getState().toggleOrientation();
          return true;
        }
        return false;
      }
      // ─── 修改主题元数据 ────────────────────────────
      case 'set_theme_meta': {
        const p = instr.params || {};
        const updates: Record<string, unknown> = {};
        if (p.name) updates.name = p.name;
        if (p.author) updates.author = p.author;
        if (p.version) updates.version = p.version;
        if (p.description) updates.description = p.description;
        const cur = useEditorStore.getState();
        cur.replaceTheme({ ...cur.theme, ...updates });
        return true;
      }
      // ─── 批量组合 ──────────────────────────────────
      case 'batch': {
        const p = instr.params || {};
        const actions = Array.isArray(p.actions) ? p.actions : [];
        let ok = true;
        for (const a of actions) {
          const sub: AIInstruction = {
            ...a, id: `instr-${Math.random().toString(36).slice(2, 8)}`,
            executed: false, confirmed: false,
          };
          ok = executeInstruction(sub) && ok;
        }
        return ok;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** 执行一组指令，带撤销快照；返回执行成功的数量 */
export function runInstructions(instrs: AIInstruction[]): { ok: number; total: number } {
  if (instrs.length === 0) return { ok: 0, total: 0 };
  // 撤销快照
  const snapshot = JSON.stringify(useEditorStore.getState().theme);
  useAIStore.getState().pushSnapshot(snapshot);

  let ok = 0;
  for (const instr of instrs) {
    if (executeInstruction(instr)) ok++;
    instr.executed = true;
  }
  return { ok, total: instrs.length };
}