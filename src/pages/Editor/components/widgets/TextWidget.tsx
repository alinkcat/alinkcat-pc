import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

export default function TextWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const content = (v.content as string) || t('common.widgets.doubleClickEdit');
  const fSize = (v.fontSize as number) || 16;
  const fWeight = (v.fontWeight as string) || 'normal';
  const fFamily = (v.fontFamily as string) || 'sans-serif';
  const color = (v.color as string) || '#333333';
  const tAlign = (v.textAlign as string) || 'left';
  const pd = (v.padding as number) ?? 4;
  const br = (widget.borderRadius as number) ?? 0;

  return (
    <div
      className="cw-text"
      style={{
        fontSize: fSize,
        fontWeight: fWeight,
        fontFamily: fFamily,
        color: color,
        textAlign: tAlign as React.CSSProperties['textAlign'],
        padding: pd,
        borderRadius: br,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
        width: '100%',
        height: '100%',
        overflow: 'auto',
      }}
    >
      {content}
    </div>
  );
}