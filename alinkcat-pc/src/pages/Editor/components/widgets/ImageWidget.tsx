import type { EditorWidget } from '../../types';

export default function ImageWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const src = v.src as string;
  const fit = (v.objectFit as string) || 'cover';
  const br = (widget.borderRadius as number) || 0;
  return (
    <div className="cw-image" style={{ borderRadius: br }}>
      {src ? (
        <img src={src} alt={widget.label} style={{ objectFit: fit as React.CSSProperties['objectFit'], borderRadius: br }} />
      ) : (
        <div className="cw-image-ph"><span>📷</span><span>上传图片</span></div>
      )}
    </div>
  );
}
