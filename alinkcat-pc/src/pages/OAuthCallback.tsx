import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Typography, Result, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { setTokens } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Text } = Typography;

export default function OAuthCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchProfile } = useAuthStore();
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // 文档约定回调参数：token / refreshToken / username
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error);
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMsg(t('oauth.noToken'));
      return;
    }

    // 存储令牌（refreshToken 可能为空，由后端按需下发）
    setTokens(token, refreshToken || '');
    fetchProfile()
      .then(() => {
        setStatus('done');
        setTimeout(() => navigate('/profile', { replace: true }), 1200);
      })
      .catch(() => {
        // 即使 profile 拉取失败，也视为登录成功
        setStatus('done');
        setTimeout(() => navigate('/profile', { replace: true }), 1200);
      });
  }, []);

  const handleBack = () => navigate('/auth');

  if (status === 'error') {
    return (
      <div className="auth-background" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Result
          status="error"
          title={t('oauth.authorizeFailed')}
          subTitle={errorMsg || t('oauth.retryLater')}
          extra={<Button type="primary" onClick={handleBack}>{t('oauth.backToLogin')}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="auth-background" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <Text type="secondary">{status === 'processing' ? t('oauth.processing') : t('oauth.loginSuccess')}</Text>
        </div>
        <Button onClick={handleBack}>{t('oauth.backToLogin')}</Button>
      </div>
    </div>
  );
}