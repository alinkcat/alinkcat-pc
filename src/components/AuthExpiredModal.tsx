import { useEffect, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearTokens } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

/**
 * Global token expired monitor.
 * Listens for custom 'auth:expired' events and shows a forced login modal.
 */
export default function AuthExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = () => {
      clearTokens();
      useAuthStore.getState().logout();
      setVisible(true);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const handleLogin = () => {
    setVisible(false);
    navigate('/auth');
  };

  return (
    <Modal
      open={visible}
      closable={false}
      mask={{ closable: false }}
      footer={[
        <Button key="login" type="primary" onClick={handleLogin}>{t('auth.goLogin')}</Button>,
      ]}
      width={400}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <Text strong style={{ fontSize: 16 }}>{t('auth.sessionExpired')}</Text>
        <div style={{ marginTop: 8, color: '#999' }}>
          {t('auth.sessionExpiredDesc')}
        </div>
      </div>
    </Modal>
  );
}