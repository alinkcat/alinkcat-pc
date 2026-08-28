import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

export default function QuickActionWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const cells = (v.cells as Array<Record<string, unknown>>) || [];

  return (
    <div className="cw-qa">
      {cells.slice(0, 4).map((cell, i) => (
        <div key={i} className="cw-qa-cell">
          {cell.type === 'launcher' ? (
            <>
              <span className="cw-qa-icon">📱</span>
              <span className="cw-qa-name">{(cell.name as string) || t('common.widgets.app')}</span>
            </>
          ) : (
            <>
              <span className="cw-qa-title">{(cell.title as string) || t('common.widgets.snippet')}</span>
              <span className="cw-qa-count">
                {t('common.widgets.count', { count: ((cell.snippets as Array<unknown>) || []).length })}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}