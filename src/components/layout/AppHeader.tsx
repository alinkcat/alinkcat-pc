import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from 'antd';
import { BellOutlined, SettingOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import logo from '../../assets/logo.png';

export default function AppHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unread, fetchUnread } = useNotificationStore();
  const { isDark, toggle } = useThemeStore();
  const { isLoggedIn } = useAuthStore();

  // only poll unread notifications when logged in；silent when not logged in，avoid pointless requests that trigger auth-expired prompts
  useEffect(() => {
    if (!isLoggedIn) {
      useNotificationStore.setState({ unread: 0 });
      return;
    }
    fetchUnread().catch(() => {});
    const timer = setInterval(() => fetchUnread().catch(() => {}), 30_000);
    return () => clearInterval(timer);
  }, [isLoggedIn, fetchUnread]);

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="header-logo">
          <img src={logo} alt="ailinkcat" style={{ height: 28, objectFit: 'contain' }} />
        </span>
        <span className="header-title">{t('common.appName')}</span>
      </div>
      <div className="header-right">
        <Tooltip title={isDark ? t('layout.header.switchLight') : t('layout.header.switchDark')}>
          <span style={{ cursor: 'pointer' }} onClick={toggle}>
            {isDark ? <SunOutlined /> : <MoonOutlined />}
          </span>
        </Tooltip>
        <Tooltip title={t('layout.header.notifications')}>
          <span style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/notifications')}>
            <BellOutlined />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16,
                borderRadius: 8, background: '#ff4d4f', color: '#fff', fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </Tooltip>
        <Tooltip title={t('layout.header.settings')}>
          <SettingOutlined style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')} />
        </Tooltip>
      </div>
    </header>
  );
}