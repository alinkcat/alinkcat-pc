import type { ThemeMeta } from '../types/theme';

// draw the cover directly on Canvas (no html2canvas dependency), returns PNG data URL for save_theme to write as cover.png
export async function generateThemeCover(theme: ThemeMeta): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 170;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // gradient background
  const grad = ctx.createLinearGradient(0, 0, 240, 170);
  grad.addColorStop(0, '#4F6EF7');
  grad.addColorStop(1, '#8c9eff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 170);

  // decorative circle
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(200, 40, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 150, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // theme name
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = theme.name || 'Untitled theme';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(name.length > 12 ? `${name.slice(0, 12)}…` : name, 120, 78);

  // version + page count
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`v${theme.version || '1.0.0'} · ${theme.pages.length}  pages`, 120, 108);

  // bottom brand bar
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 150, 240, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.fillText('ailinkcat', 120, 160);

  return canvas.toDataURL('image/png');
}

/** generate a default placeholder cover（used when there are no pages） */
export async function generateDefaultCover(name: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 170;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#e0e5f0';
  ctx.fillRect(0, 0, 240, 170);
  ctx.fillStyle = '#8a94ad';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText((name || '?').charAt(0).toUpperCase(), 120, 85);

  return canvas.toDataURL('image/png');
}
