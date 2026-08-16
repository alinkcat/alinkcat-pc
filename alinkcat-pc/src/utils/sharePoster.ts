/**
 * 分享海报生成工具
 * 使用 HTML Canvas 创建美观的主题分享海报
 */

interface PosterTheme {
  name: string;
  version: string;
  author: string;
  cover_url?: string | null;
}

/**
 * 生成分享海报的 data URL
 * 包含主题名称、版本、作者信息，以及美观的背景渐变
 * 简化版本：不包含二维码（需要后端配合分享链接，先不做）
 */
export async function generateSharePoster(theme: PosterTheme): Promise<string> {
  const width = 600;
  const height = 800;

  // 创建 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 绘制渐变背景
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#4F6EF7');
  gradient.addColorStop(0.5, '#7C5CFC');
  gradient.addColorStop(1, '#A855F7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 绘制装饰性圆形
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(width * 0.8, height * 0.15, 180, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width * 0.15, height * 0.85, 120, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, 250, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // 绘制标题区域
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 主题名称（支持换行）
  const name = theme.name || '未命名主题';
  const maxWidth = width - 80;
  let fontSize = 48;
  ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  while (ctx.measureText(name).width > maxWidth && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  }
  ctx.fillText(name, width / 2, height * 0.3);

  // 装饰线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 60, height * 0.38);
  ctx.lineTo(width / 2 + 60, height * 0.38);
  ctx.stroke();

  // 版本信息
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`v${theme.version || '1.0.0'}`, width / 2, height * 0.44);

  // 作者信息
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(`作者：${theme.author || '未知'}`, width / 2, height * 0.50);

  // 如果有封面图，在下方绘制
  if (theme.cover_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cover image'));
        img.src = theme.cover_url!;
      });

      // 圆角封面图
      const coverSize = 160;
      const coverX = (width - coverSize) / 2;
      const coverY = height * 0.58;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 16);
      ctx.clip();
      ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
      ctx.restore();
    } catch {
      // 封面加载失败，显示占位
      const coverSize = 160;
      const coverX = (width - coverSize) / 2;
      const coverY = height * 0.58;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 16);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎨', coverX + coverSize / 2, coverY + coverSize / 2);
    }
  }

  // 底部品牌水印
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('由 AlinkCat 主题管理器生成', width / 2, height - 30);

  return canvas.toDataURL('image/png');
}

/**
 * 将 data URL 下载为图片文件
 */
export function downloadPoster(dataUrl: string, filename: string = 'theme-poster.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}