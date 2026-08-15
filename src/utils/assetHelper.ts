import { tauriInvoke } from './tauri';
import type { ThemeMeta } from '../types/theme';

/** 判断是否为相对路径（非 data URL、非 http/file URL） */
export function isRelativePath(p: string): boolean {
  return !p.startsWith('data:') && !/^(https?|file):\/\//i.test(p);
}

/**
 * 解析图片引用为可显示地址：
 * - data: → 原样
 * - http(s)/file → 原样
 * - 相对路径（如 assets/bg.png）→ 通过 get_image 命令读取主题包内文件，返回 data URL
 */
export async function getAssetUrl(themeId: string, assetPath: string): Promise<string> {
  if (!assetPath) return '';
  if (assetPath.startsWith('data:')) return assetPath;
  if (/^(https?|file):\/\//i.test(assetPath)) return assetPath;
  try {
    return await tauriInvoke<string>('get_image', { themeId, imagePath: assetPath });
  } catch {
    return '';
  }
}

/**
 * 加载主题包时，将 theme.json 中所有相对图片路径解析为 data URL，
 * 使编辑器内可直接显示背景图 / 控件图片 / 图标。
 */
export async function resolveThemeImages(meta: ThemeMeta): Promise<ThemeMeta> {
  const clone = JSON.parse(JSON.stringify(meta)) as ThemeMeta;

  for (const page of clone.pages) {
    const layout = page.layout as unknown as Record<string, unknown>;
    const bg = layout.backgroundImage;
    if (typeof bg === 'string' && isRelativePath(bg)) {
      layout.backgroundImage = await getAssetUrl(clone.id, bg);
    }

    for (const w of page.widgets) {
      const wv = w as unknown as Record<string, unknown>;
      if (typeof wv.src === 'string' && isRelativePath(wv.src)) {
        wv.src = await getAssetUrl(clone.id, wv.src);
      }
      if (typeof wv.icon === 'string' && isRelativePath(wv.icon)) {
        wv.icon = await getAssetUrl(clone.id, wv.icon);
      }
    }
  }

  return clone;
}
