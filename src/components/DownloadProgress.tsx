import { useState, useCallback } from 'react';
import { Modal, Progress, Typography } from 'antd';
import { tauriInvoke } from '../utils/tauri';
import { useDownloadStore } from '../store/downloadStore';

const { Text } = Typography;

interface ProgressState {
  visible: boolean;
  fileName: string;
  percent: number;
  status: 'downloading' | 'done' | 'error';
  message: string;
}

/**
 * Download with progress indicator.
 * Downloads via Rust backend (no CORS), stores in queue.
 */
export function useDownloadProgress() {
  const [state, setState] = useState<ProgressState>({
    visible: false, fileName: '', percent: 0, status: 'downloading', message: '',
  });

  const startDownload = useCallback(async (url: string, name: string, themeId: string, version: string, author: string) => {
    setState({ visible: true, fileName: name, percent: 0, status: 'downloading', message: '正在下载...' });

    try {
      // Simulate progress (real progress tracking requires server-side support)
      // We show 50% while downloading, then jump to 100%
      setState((s) => ({ ...s, percent: 50 }));

      const filename = `${themeId}.alc`;
      const filePath = await tauriInvoke<string>('download_theme_file', { url, filename });

      setState((s) => ({ ...s, percent: 100, status: 'done', message: '下载完成' }));

      useDownloadStore.getState().add({
        id: `${themeId}-${Date.now()}`,
        themeId, name, version, author,
        filePath,
        downloadedAt: new Date().toISOString(),
      });

      // Auto close after 1.5s
      setTimeout(() => setState((s) => ({ ...s, visible: false })), 1500);
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', message: String(e) }));
    }
  }, []);

  const modal = (
    <Modal
      open={state.visible}
      closable={state.status === 'error'}
      footer={null}
      width={360}
      centered
      mask={{ closable: false }}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Text strong style={{ fontSize: 15 }}>{state.fileName}</Text>
        <Progress
          percent={state.percent}
          status={state.status === 'error' ? 'exception' : state.status === 'done' ? 'success' : 'active'}
          style={{ marginTop: 16 }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{state.message}</Text>
      </div>
    </Modal>
  );

  return { startDownload, downloadModal: modal };
}