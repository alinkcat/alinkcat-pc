import { tauriInvoke } from './tauri';
import type { PackedTheme } from '../types/push';

/** pack the theme into a .alc (stored as ZIP), returns base64 + size + hash. */
export async function packTheme(themeId: string): Promise<PackedTheme> {
  return tauriInvoke<PackedTheme>('pack_theme_data', { themeId });
}
