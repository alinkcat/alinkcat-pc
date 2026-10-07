import { tauriInvoke } from './tauri';
import type { ThemeMeta } from '../types/theme';

// relative path = not a data URL and not an http/file URL
export function isRelativePath(p: string): boolean {
  return !p.startsWith('data:') && !/^(https?|file):\/\//i.test(p);
}

// data:/http(s)/file pass through as-is,
// relative paths (assets/bg.png) are read from the theme pack via get_image and returned as data URLs
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

// resolve every relative image path in theme.json to a data URL on load,
// so backgrounds / widget images / icons render directly in the editor
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
