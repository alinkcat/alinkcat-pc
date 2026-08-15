import type { EditorWidget } from '../../types';

export default function QuickActionWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const cells = (v.cells as Array<Record<string, unknown>>) || [];

  return (
    <div className="cw-qa">
      {cells.slice(0, 4).map((cell, i) => (
        <div key={i} className="cw-qa-cell">
          {cell.type === 'launcher' ? (
            <>
              <span className="cw-qa-icon">📱</span>
              <span className="cw-qa-name">{(cell.name as string) || '应用'}</span>
            </>
          ) : (
            <>
              <span className="cw-qa-title">{(cell.title as string) || '片段'}</span>
              <span className="cw-qa-count">
                {((cell.snippets as Array<unknown>) || []).length} 条
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}