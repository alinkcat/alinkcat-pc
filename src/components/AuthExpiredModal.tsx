import { useEffect, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearTokens } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

// 每会话只弹一次：用户选择"暂不登录"后记录，本次运行不再弹
const DISMISS_KEY = 'ilinkcat_auth_expired_dismissed';

function wasDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

function markDismissed() {
  try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
}

/**
 * 登录过期提示（非强制）。
 * 监听 'auth:expired' 事件：
 * - 支持"暂不登录"关闭，用户拒绝后本次会话不再弹出
 * - 说明登录后可以享受的权益，引导用户自愿登录
 * - 登录成功后可再次触发（见 authStore.resetAuthExpiredFlag）
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
      maskClosable={false}
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
