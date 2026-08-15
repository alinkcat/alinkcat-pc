import type { EditorWidget } from '../../types';

export default function ButtonWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  return (
    <div className="cw-button">
      <span className="cw-icon">{(v.icon as string) || '🔘'}</span>
      <span className="cw-label">{widget.label || '按钮'}</span>
    </div>
  );
}
