import { useState, useRef, useCallback } from 'react';

export function usePanelResize(initial: number, key: string, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    const s = localStorage.getItem(key);
    return s ? Math.min(max, Math.max(min, Number(s))) : initial;
  });
  const ref = useRef(width);
  ref.current = width;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sw = ref.current;
    const onMove = (ev: MouseEvent) => setWidth(Math.min(max, Math.max(min, sw + ev.clientX - sx)));
    const onUp = () => {
      localStorage.setItem(key, String(ref.current));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [key, min, max]);

  const onRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sw = ref.current;
    const onMove = (ev: MouseEvent) => setWidth(Math.min(max, Math.max(min, sw - ev.clientX + sx)));
    const onUp = () => {
      localStorage.setItem(key, String(ref.current));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [key, min, max]);

  return { width, onMouseDown, onRightMouseDown };
}
