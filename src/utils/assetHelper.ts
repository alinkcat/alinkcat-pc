import { tauriInvoke } from './tauri';
import type { ThemeMeta } from '../types/theme';

/** check if a relative path（not a data URL, not an http/file URL） */
export function isRelativePath(p: string): boolean {
  return !p.startsWith('data:') && !/^(https?|file):\/\//i.test(p);
}

/**
 * resolve image references to displayable URLs：
 * - data: → as-is
 * - http(s)/file → as-is
 * - relative path (e.g. assets/bg.png) → read from theme via get_image，returns a data URL
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
 * when loading a theme，resolve all relative image paths in theme.json to data URLs，
 * so the editor can show backgrounds / widget images / icons directly。
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
      if (typeof wv.cardImage === 'string' && isRelativePath(wv.cardImage)) {
        wv.cardImage = await getAssetUrl(clone.id, wv.cardImage);
      }
    }
  }

  return clone;
}
