import { useEditorStore } from '../store/editorStore';

export default function FreeGuideLines() {
  const snapX = useEditorStore(s => s.snapX);
  const snapY = useEditorStore(s => s.snapY);
  return (
    <div className={`canvas-guides${snapX ? ' guide-snap-v' : ''}${snapY ? ' guide-snap-h' : ''}`} />
  );
}
