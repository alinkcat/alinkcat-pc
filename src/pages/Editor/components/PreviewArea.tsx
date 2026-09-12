import { useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CloseOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '../store/editorStore';
import { useWidgetDrag } from '../hooks/useWidgetDrag';
import type { EditorWidget, EditorPage } from '../types';
import WidgetRenderer from './widgets/WidgetRenderer';
import PhoneFrame from './PhoneFrame';
import GridOverlay from './GridOverlay';
import FreeGuideLines from './FreeGuideLines';

function CanvasWidget({ widget, page, canvasW, canvasH }: {
  widget: EditorWidget; page: EditorPage; canvasW: number; canvasH: number;
}) {
  const { selectedWidgetId, removeWidget } = useEditorStore();
  const isSelected = widget.id === selectedWidgetId;
  const isGrid = page.layoutMode === 'grid';
  const { onMouseDown, onResizeMouseDown } = useWidgetDrag(widget, page, canvasW, canvasH);

  const cols = page.columns;
  const rows = page.rows;
  const cellW = canvasW / cols;
  const cellH = canvasH / rows;

  const style: React.CSSProperties = isGrid
    ? { left: widget.gridCol * cellW, top: widget.gridRow * cellH, width: widget.gridW * cellW, height: widget.gridH * cellH, zIndex: widget.zIndex }
    : { left: `${widget.freeX ?? 0}%`, top: `${widget.freeY ?? 0}%`, width: `${widget.freeW ?? 30}%`, height: `${widget.freeH ?? 15}%`, zIndex: widget.zIndex };

  return (
    <div className={`cw${isSelected ? ' cw-selected' : ''}`} style={style}
      onMouseDown={onMouseDown} onClick={e => e.stopPropagation()}>
      <WidgetRenderer widget={widget} />
      <div className="cw-del" onClick={e => { e.stopPropagation(); removeWidget(widget.id); }}><CloseOutlined /></div>
      {isSelected && <div className="cw-resize" onMouseDown={onResizeMouseDown} />}
      {isSelected && !isGrid && (
        <div className="cw-coords">
          {Math.round(widget.freeX ?? 0)}%, {Math.round(widget.freeY ?? 0)}% · {Math.round(widget.freeW ?? 30)}%×{Math.round(widget.freeH ?? 15)}%
        </div>
      )}
    </div>
  );
}

function buildBgStyle(page: EditorPage): React.CSSProperties {
  const s: React.CSSProperties = {};
  // backgroundColor 可能为纯色（#0a0e1a）或 CSS 渐变（linear-gradient(...)）：
  // 渐变必须写入 background / background-image 属性，background-color 不接受 gradient 值
  const bg = page.backgroundColor;
  if (bg && /gradient\(/i.test(bg)) {
    s.background = bg;
  } else if (bg) {
    s.backgroundColor = bg;
  }
  if (page.backgroundImage) {
    // 有图片时叠加在底色/渐变之上（渐变 + 图片并存：图片优先，保留底图视觉）
    s.backgroundImage = `url(${page.backgroundImage})`;
    const m = (page.backgroundMode || 'cover') as string;
    // 'tile' 是传输层/Mobile 使用的值（编辑器用 'repeat'），两者等价，都按平铺处理
    s.backgroundSize = m === 'cover' ? 'cover' : m === 'contain' ? 'contain' : m === 'stretch' ? '100% 100%' : 'auto';
    s.backgroundRepeat = (m === 'repeat' || m === 'tile') ? 'repeat' : 'no-repeat';
    s.backgroundPosition = 'center';
    s.opacity = (page.backgroundOpacity ?? 100) / 100;
  }
  return s;
}

export default function PreviewArea() {
  const { t } = useTranslation();
  const { theme, activePageIdx, orientation, zoom, selectWidget } = useEditorStore();
  const page = theme.pages[activePageIdx] ?? null;
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  const baseW = orientation === 'portrait' ? 260 : 460;
  const baseH = orientation === 'portrait' ? 460 : 260;
  const frameW = Math.round(baseW * zoom / 100);
  const frameH = Math.round(baseH * zoom / 100);
  const canvasH = frameH - 24;

  const isFree = page?.layoutMode === 'free';
  const cols = page?.columns || 4;
  const rows = page?.rows || 6;

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t === e.currentTarget || t.classList.contains('canvas-grid') || t.classList.contains('canvas-bg') || t.classList.contains('canvas-guides')) {
      selectWidget(null);
    }
  }, [selectWidget]);

  return (
    <div className="editor-preview">
      <div className="preview-area">
        <PhoneFrame width={frameW} height={frameH} orientation={orientation}>
          <div ref={setNodeRef} className={`canvas${isOver ? ' canvas-over' : ''}`} onClick={handleCanvasClick}>
            {(page?.backgroundColor || page?.backgroundImage) && <div className="canvas-bg" style={buildBgStyle(page)} />}
            {isFree ? <FreeGuideLines /> : <GridOverlay cellW={frameW / cols} cellH={canvasH / rows} />}
            {page?.widgets.map(w => (
              <CanvasWidget key={w.id} widget={w} page={page} canvasW={frameW} canvasH={canvasH} />
            ))}
            {(!page || page.widgets.length === 0) && (
              <div className="canvas-empty">
                <AppstoreOutlined style={{ fontSize: 28, color: '#bbb' }} />
                <span>{t('common.widgets.preview.dragHint')}</span>
              </div>
            )}
          </div>
          <div className="phone-dots">
            {theme.pages.map((p, i) => (
              <span key={p.id} className={`phone-dot${i === activePageIdx ? ' active' : ''}`}
                onClick={() => useEditorStore.getState().setActivePage(i)} title={p.label} />
            ))}
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
