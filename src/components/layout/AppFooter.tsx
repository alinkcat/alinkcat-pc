import { useEffect } from 'react';
import { Flex, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useServerStatusStore } from '../../store/serverStatusStore';
import { DEFAULT_SETTINGS } from '../../types/theme';

const SETTINGS_KEY = 'ilinkcat_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export default function AppFooter() {
  const { t } = useTranslation();
  const { running, port, deviceCount, fetchStatus } = useServerStatusStore();

  useEffect(() => {
    // fetch once up front, show current status regardless of the toggle
    fetchStatus();
    // the backend pushes this event on every device connect/disconnect, so the
    // counter stays accurate even with status polling turned off
    let unlisten: (() => void) | undefined;
    let disposed = false;
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<number>('ws-clients-changed', () => {
          fetchStatus();
        })
      )
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // not running inside Tauri (vite dev in a plain browser)
      });
    // polling follows settings: silent when off, no IPC requests
    const settings = loadSettings();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (settings.status_polling) {
      const intervalMs = Math.max(1, settings.status_polling_interval || 3) * 1000;
      timer = setInterval(fetchStatus, intervalMs);
    }
    return () => {
      disposed = true;
      unlisten?.();
      if (timer) clearInterval(timer);
    };
  }, [fetchStatus]);

  return (
    <footer className="app-footer">
      <Flex align="center" gap={16} style={{ minWidth: 0 }}>
        <span className="footer-status">
          <span className={`footer-status-dot ${running ? 'footer-status-dot--active' : 'stopped'}`} />
          {running ? t('layout.footer.running') : t('layout.footer.stopped')}
        </span>
        <Tooltip title={`${t('layout.footer.port')}：${port}`}>
          <span className="footer-item">{t('layout.footer.port')}：{port}</span>
        </Tooltip>
      </Flex>
      <Flex align="center" gap={16} style={{ flexShrink: 0 }}>
        <Tooltip title={`${t('layout.footer.devices')}：${deviceCount}`}>
          <span className="footer-item">{t('layout.footer.devices')}：{deviceCount}</span>
        </Tooltip>
      </Flex>
    </footer>
  );
}
