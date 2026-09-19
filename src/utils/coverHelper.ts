import { tauriInvoke } from './tauri';
import type { ThemeMeta } from '../types/theme';

/** generate a fixed color from the theme id（picked from the HSL hue wheel） */
export function getColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

/** take the first character of the theme name (uppercase) */
export function getInitials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/**
 * resolve image references to data URLs：
 * - starts with data: → return as-is
 * - http(s)/file → return as-is (remote/local absolute path)
 * - relative path → read from theme assets via get_image
 */
export async function resolveImage(themeId: string, ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('data:')) return ref;
  if (/^(https?|file):\/\//i.test(ref)) return ref;
  try {
    return await tauriInvoke<string>('get_image', { themeId, imagePath: ref });
  } catch {
    return null;
  }
}

/**
 * before saving a theme，migrate embedded base64 images in theme.json to the assets/ directory，
 * and replace references with relative paths（assets/xxx.png）。
 */
export async function migrateImagesToAssets(meta: ThemeMeta): Promise<ThemeMeta> {
  const clone = JSON.parse(JSON.stringify(meta)) as ThemeMeta;
  const tasks: Promise<void>[] = [];

  const save = async (dataUrl: string, widgetId: string) => {
    try {
      return await tauriInvoke<string>('save_image', { imageData: dataUrl, themeId: clone.id, widgetId });
    } catch {
      return dataUrl;
    }
  };
  const saveIcon = async (dataUrl: string, widgetId: string) => {
    try {
      return await tauriInvoke<string>('save_icon', { imageData: dataUrl, themeId: clone.id, widgetId });
    } catch {
      return dataUrl;
    }
  };

  for (const page of clone.pages) {
    const layout = page.layout as unknown as Record<string, unknown>;
    const bg = layout.backgroundImage;
    if (typeof bg === 'string' && bg.startsWith('data:')) {
      tasks.push(save(bg, `page-${page.id}`).then((rel) => { layout.backgroundImage = rel; }));
    }

    for (const w of page.widgets) {
      const wv = w as Record<string, unknown>;
      if (typeof wv.src === 'string' && wv.src.startsWith('data:')) {
        tasks.push(save(wv.src, `w-${w.id}`).then((rel) => { wv.src = rel; }));
      }
      if (typeof wv.icon === 'string' && wv.icon.startsWith('data:image/')) {
        tasks.push(saveIcon(wv.icon, `w-${w.id}`).then((rel) => { wv.icon = rel; }));
      }
      // image for the Card widget
      if (typeof wv.cardImage === 'string' && wv.cardImage.startsWith('data:')) {
        tasks.push(save(wv.cardImage, `w-${w.id}`).then((rel) => { wv.cardImage = rel; }));
      }
    }
  }

  await Promise.all(tasks);
  return clone;
}
