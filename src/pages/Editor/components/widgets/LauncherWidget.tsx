import type { EditorWidget } from '../../types';

export default function LauncherWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const name = (v.name as string) || '应用';
  const icon = (v.icon as string) || '';

  return (
    <div className="cw-launcher">
      {icon ? (
        <img src={icon} alt={name} className="cw-launcher-img" />
      ) : (
        <span className="cw-launcher-icon">📱</span>
      )}
      <span className="cw-launcher-name">{name}</span>
    </div>
  );
}