import { useEffect, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearTokens } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

// only once per session：user chooses"skip for now"then record，do not show again this session
const DISMISS_KEY = 'ilinkcat_auth_expired_dismissed';

function wasDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

function markDismissed() {
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
}

/**
 * auth-expired notice（non-blocking）。
 * listen for 'auth:expired' event：
 * - support"skip for now"close，after the user dismisses, do not show again this session
 * - explain the benefits of logging in，guide the user to log in voluntarily
 * - can trigger again after successful login（see authStore.resetAuthExpiredFlag）
 */
export default function AuthExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = () => {
      if (wasDismissed()) return;
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

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
  };

  return (
    <Modal
      open={visible}
      closable={false}
      mask={{ closable: false }}
      footer={[
        <Button key="dismiss" onClick={handleDismiss}>{t('auth.later')}</Button>,
        <Button key="login" type="primary" onClick={handleLogin}>{t('auth.goLogin')}</Button>,
      ]}
      width={420}
    >
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>🔒</div>
        <Text strong style={{ fontSize: 16 }}>{t('auth.sessionExpired')}</Text>
        <div style={{ marginTop: 8, color: '#999', fontSize: 13 }}>
          {t('auth.sessionExpiredDesc')}
        </div>
      </div>
      <div style={{ marginTop: 16, background: '#f6f8fb', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t('auth.loginBenefitsTitle')}</div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 2 }}>
          <div>☁️ {t('auth.benefitCloud')}</div>
          <div>🛒 {t('auth.benefitMarket')}</div>
          <div>🤖 {t('auth.benefitAI')}</div>
          <div>👑 {t('auth.benefitMember')}</div>
          <div>🔗 {t('auth.benefitSync')}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#aaa', textAlign: 'center' }}>
        {t('auth.sessionExpiredOptional')}
      </div>
    </Modal>
  );
}
