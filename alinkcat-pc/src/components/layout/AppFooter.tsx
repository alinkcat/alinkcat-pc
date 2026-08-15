import { useEffect } from 'react';
import { Flex, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useServerStatusStore } from '../../store/serverStatusStore';

export default function AppFooter() {
  const { t } = useTranslation();
  const { running, port, deviceCount, fetchStatus } = useServerStatusStore();

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

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