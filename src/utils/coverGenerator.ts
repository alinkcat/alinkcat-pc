import type { ThemeMeta } from '../types/theme';

/**
 * 使用 Canvas 生成主题包封面图（240x170, 3:2）。
 * 降级方案：不依赖 html2canvas，直接绘制渐变背景 + 主题名。
 * 返回 PNG data URL，供 save_theme 命令写入 cover.png。
 */
export async function generateThemeCover(theme: ThemeMeta): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 170;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 渐变背景
  const grad = ctx.createLinearGradient(0, 0, 240, 170);
  grad.addColorStop(0, '#4F6EF7');
  grad.addColorStop(1, '#8c9eff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 170);

  // 装饰圆
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(200, 40, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, 150, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 主题包名称
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = theme.name || '未命名主题包';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(name.length > 12 ? `${name.slice(0, 12)}…` : name, 120, 78);

  // 版本 + 页面数
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`v${theme.version || '1.0.0'} · ${theme.pages.length} 个页面`, 120, 108);

  // 底部品牌条
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 150, 240, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.fillText('艾联猫 · iLinkCat', 120, 160);

  return canvas.toDataURL('image/png');
}

/** 生成默认占位封面（无页面时使用） */
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
