import { tauriInvoke } from './tauri';
import type { PackedTheme } from '../types/push';

/** pack a theme into .alc (in-memory zip), returns base64 + size + hash */
export async function packTheme(themeId: string): Promise<PackedTheme> {
  return tauriInvoke<PackedTheme>('pack_theme_data', { themeId });
}
