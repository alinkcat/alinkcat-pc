import type { EditorWidget } from '../../types';

const CLIP_PATHS: Record<string, string> = {
  rect: 'none',
  'rounded-rect': 'none',
  circle: 'none',
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
};

export default function ShapeWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const shapeType = (v.shapeType as string) || 'rect';
  const fillType = (v.fillType as string) || 'solid';
  const fillColor = (v.fillColor as string) || '#d9d9d9';
  const gradientStart = (v.gradientStart as string) || '#4F6EF7';
  const gradientEnd = (v.gradientEnd as string) || '#52c41a';
  const gradientAngle = (v.gradientAngle as number) ?? 90;
  const borderColor = (v.borderColor as string) || 'transparent';
  const borderWidth = (v.borderWidth as number) ?? 0;
  const borderRadius = (widget.borderRadius as number) ?? 0;
  const opacity = ((v.opacity as number) ?? 100) / 100;

  const isCircle = shapeType === 'circle';
  const isRounded = shapeType === 'rounded-rect';
  const borderRadiusValue = isCircle ? '50%' : (isRounded ? borderRadius : 0);

  const background = fillType === 'gradient'
    ? `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`
    : fillColor;

  return (
    <div
      className="cw-shape"
      style={{
        width: '100%',
        height: '100%',
        background,
        borderRadius: borderRadiusValue,
        border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
        clipPath: CLIP_PATHS[shapeType] || 'none',
        opacity,
      }}
    />
  );
}
