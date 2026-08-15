export default function GridOverlay({ cellW, cellH }: { cellW: number; cellH: number }) {
  return <div className="canvas-grid" style={{ backgroundSize: `${cellW}px ${cellH}px` }} />;
}
