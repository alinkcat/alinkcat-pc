import { tauriInvoke } from './tauri';
import type { ThemeMeta } from '../types/theme';

/** 根据主题包 ID 生成固定颜色（HSL 色相环取值） */
export function getColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

/** 取主题包名称首字符（大写） */
export function getInitials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/**
 * 解析图片引用为可直接显示的 data URL：
 * - data: 开头 → 原样返回
 * - http(s)/file → 原样返回（远程/本地绝对路径）
 * - 相对路径 → 通过 get_image 命令从主题包 assets/ 读取
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
 * 保存主题包前，将 theme.json 中内嵌的 base64 图片迁移到 assets/ 目录，
 * 并将引用替换为相对路径（assets/xxx.png）。
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
    }
  }

  await Promise.all(tasks);
  return clone;
}
