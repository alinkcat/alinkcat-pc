export default function ResizeHandle({ onMouseDown, isSelected }: {
  onMouseDown: (e: React.MouseEvent) => void;
  isSelected: boolean;
}) {
  if (!isSelected) return null;
  return <div className="cw-resize" onMouseDown={onMouseDown} />;
}
