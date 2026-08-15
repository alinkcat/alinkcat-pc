import type { EditorWidget } from '../../types';

export default function StickyNoteWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const mode = (v.mode as string) || 'note';
  const snippets = (v.snippets as Array<{ id: string; label: string; content: string }>) || [];
  return (
    <div className="cw-sticky">
      <div className="cw-sticky-title">
        {widget.label || '便签'}
        {mode === 'snippet' && <span className="cw-sticky-badge">快捷</span>}
      </div>
      <div className="cw-sticky-list">
        {snippets.length === 0
          ? <div className="cw-sticky-empty">暂无条目</div>
          : snippets.map(s => (
            <div key={s.id} className="cw-sticky-item">
              <span className="cw-sticky-label">{s.label}</span>
              {s.content && <span className="cw-sticky-content">{s.content}</span>}
            </div>
          ))
        }
      </div>
    </div>
  );
}