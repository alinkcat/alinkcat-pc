import { tauriInvoke } from './tauri';
import type { PackedTheme } from '../types/push';

/** 将主题包打包为 .alc（内存 ZIP），返回 base64 + 大小 + 哈希。 */
export async function packTheme(themeId: string): Promise<PackedTheme> {
  return tauriInvoke<PackedTheme>('pack_theme_data', { themeId });
}
