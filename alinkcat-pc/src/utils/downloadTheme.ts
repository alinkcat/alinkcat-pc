import { tauriInvoke } from './tauri';
import { themeApi } from '../api/themeApi';
import { useDownloadStore } from '../store/downloadStore';
import type { ThemeItem } from '../api/types';

/**
 * Download only: increment counter, download via Rust backend (no CORS), save to disk, store file path in queue.
 */
export async function downloadToQueue(item: ThemeItem): Promise<void> {
  await themeApi.download(item.id).catch(() => {});

  const url = item.ossUrl || item.fileUrl;
  if (!url) throw new Error('No downloadable file available');

  const filename = `${item.themeId}.alc`;
  // Download via Rust backend — saves to ~/.ilinkcat/downloads/ and returns the file path
  const filePath = await tauriInvoke<string>('download_theme_file', { url, filename });

  useDownloadStore.getState().add({
    id: `${item.themeId}-${Date.now()}`,
    themeId: item.themeId,
    name: item.name,
    version: item.version,
    author: item.author || '',
    filePath,
    downloadedAt: new Date().toISOString(),
  });
}