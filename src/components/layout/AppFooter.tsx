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
    // fetch once initially（regardless of toggle，show current status）
    fetchStatus();
    // periodic polling follows settings：silent when disabled，no IPC requests
    const settings = loadSettings();
    if (!settings.status_polling) return;
    const intervalMs = Math.max(1, settings.status_polling_interval || 3) * 1000;
    const timer = setInterval(fetchStatus, intervalMs);
    return () => clearInterval(timer);
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
