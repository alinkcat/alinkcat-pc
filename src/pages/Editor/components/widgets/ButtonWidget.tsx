import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

export default function ButtonWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  return (
    <div className="cw-button">
      <span className="cw-icon">{(v.icon as string) || '🔘'}</span>
      <span className="cw-label">{widget.label || t('common.widgets.button')}</span>
    </div>
  );
}