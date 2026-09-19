import { useCallback } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { EditorWidget, EditorPage } from '../types';

const SNAP_PX = 10;

export function useWidgetDrag(widget: EditorWidget, page: EditorPage, canvasW: number, canvasH: number) {
  const { selectWidget, moveWidget, resizeWidget, moveWidgetFree, resizeWidgetFree, setSnapLines } = useEditorStore();
  const isGrid = page.layoutMode === 'grid';
  const cols = page.columns;
  const rows = page.rows;
  const cellW = canvasW / cols;
  const cellH = canvasH / rows;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.cw-resize') || t.closest('.cw-del')) return;
    e.preventDefault();
    e.stopPropagation();
    selectWidget(widget.id);

    const sx = e.clientX, sy = e.clientY;
    const sCol = widget.gridCol, sRow = widget.gridRow;
    const sfx = widget.freeX!, sfy = widget.freeY!;

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (isGrid) {
        moveWidget(widget.id,
          Math.max(0, Math.min(cols - widget.gridW, sCol + Math.round((ev.clientX - sx) / cellW))),
          Math.max(0, Math.min(rows - widget.gridH, sRow + Math.round((ev.clientY - sy) / cellH))));
      } else {
        let newX = Math.max(0, Math.min(100 - widget.freeW!, sfx + (ev.clientX - sx) / canvasW * 100));
        let newY = Math.max(0, Math.min(100 - widget.freeH!, sfy + (ev.clientY - sy) / canvasH * 100));

        const thrX = SNAP_PX / canvasW * 100;
        const thrY = SNAP_PX / canvasH * 100;
        let sx2 = false, sy2 = false;

        const cx = newX + widget.freeW! / 2;
        const cy = newY + widget.freeH! / 2;

        if (Math.abs(cx - 50) <= thrX) { newX = 50 - widget.freeW! / 2; sx2 = true; }
        else if (Math.abs(newX - 50) <= thrX) { newX = 50; sx2 = true; }
        else if (Math.abs(newX + widget.freeW! - 50) <= thrX) { newX = 50 - widget.freeW!; sx2 = true; }

        if (Math.abs(cy - 50) <= thrY) { newY = 50 - widget.freeH! / 2; sy2 = true; }
        else if (Math.abs(newY - 50) <= thrY) { newY = 50; sy2 = true; }
        else if (Math.abs(newY + widget.freeH! - 50) <= thrY) { newY = 50 - widget.freeH!; sy2 = true; }

        setSnapLines(sx2, sy2);
        moveWidgetFree(widget.id, newX, newY);
      }
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSnapLines(false, false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [widget.id, widget.gridCol, widget.gridRow, widget.gridW, widget.gridH, widget.freeX!, widget.freeY!, widget.freeW!, widget.freeH!, isGrid, cols, rows, cellW, cellH, canvasW, canvasH, selectWidget, moveWidget, moveWidgetFree, setSnapLines]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const sW = widget.gridW, sH = widget.gridH;
    const sfW = widget.freeW!, sfH = widget.freeH!;

    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (isGrid) {
        resizeWidget(widget.id,
          Math.max(1, Math.min(cols - widget.gridCol, sW + Math.round((ev.clientX - sx) / cellW))),
          Math.max(1, Math.min(rows - widget.gridRow, sH + Math.round((ev.clientY - sy) / cellH))));
      } else {
        resizeWidgetFree(widget.id,
          Math.max(5, Math.min(100 - widget.freeX!, sfW + (ev.clientX - sx) / canvasW * 100)),
          Math.max(5, Math.min(100 - widget.freeY!, sfH + (ev.clientY - sy) / canvasH * 100)));
      }
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [widget.id, widget.gridCol, widget.gridRow, widget.gridW, widget.gridH, widget.freeX!, widget.freeY!, widget.freeW!, widget.freeH!, isGrid, cols, rows, cellW, cellH, canvasW, canvasH, resizeWidget, resizeWidgetFree]);

  return { onMouseDown, onResizeMouseDown };
}
