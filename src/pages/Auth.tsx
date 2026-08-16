import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Tabs, Typography, Space, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, GithubOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/authApi';
import { useMessage } from '../hooks/useMessage';
import { OAuthWaitingModal, startGithubOAuth } from '../components/OAuthLogin';
import type { RegisterStatus } from '../api/types';

const { Title, Text } = Typography;

export default function Auth() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login, register, loading, isLoggedIn } = useAuthStore();
  const [loginForm] = Form.useForm();
  const [regForm] = Form.useForm();
  const { message: msg } = useMessage();

  const [regStatus, setRegStatus] = useState<RegisterStatus | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loginAgreed, setLoginAgreed] = useState(false);
  const [regAgreed, setRegAgreed] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthOpen, setOauthOpen] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [oauthErrorAction, setOauthErrorAction] = useState<'register' | 'retry' | 'close' | 'contact' | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoggedIn) navigate('/profile', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    authApi.registerStatus().then((resp) => {
      if (resp.code === 200 && resp.data) {
        setRegStatus(resp.data);
        setNeedCode(resp.data.needsVerification);
      }
    }).catch(() => {});
}, []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (isLoggedIn) return null;

  // GitHub OAuth 登录（系统浏览器 + 等待弹窗）
  const handleGithubLogin = async () => {
    setOauthLoading(true);
    setOauthOpen(true);
    setOauthError('');
    setOauthErrorAction(undefined);
    try {
      const ok = await startGithubOAuth();
      if (ok) {
        setOauthOpen(false);
        msg.success(t('auth.githubLoginSuccess'));
        navigate('/profile');
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setOauthError(errMsg);
      // 解析错误类型以显示对应按钮
      if (errMsg.includes('未绑定') || errMsg.includes('注册')) {
        setOauthErrorAction('register');
      } else if (errMsg.includes('过期') || errMsg.includes('重试')) {
        setOauthErrorAction('retry');
      } else if (errMsg.includes('禁用') || errMsg.includes('客服')) {
        setOauthErrorAction('contact');
      } else {
        setOauthErrorAction('close');
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const onLogin = async () => {
    if (!loginAgreed) return msg.warning(t('auth.pleaseAgreeTerms'));
    try {
      const values = await loginForm.validateFields();
      await login(values.username, values.password);
      msg.success(t('auth.loginSuccess'));
      navigate('/profile');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        msg.error(String((e as Error).message), 4);
      } else {
        msg.error(t('auth.loginFailed'));
      }
    }
  };

  const handleSendCode = async () => {
    try {
      const username = regForm.getFieldValue('username');
      const email = regForm.getFieldValue('email');
      if (!username) return msg.warning(t('auth.pleaseEnterUsername'));
      if (!email) return msg.warning(t('auth.pleaseEnterEmail'));
      setCodeSending(true);
      await authApi.sendRegisterCode({ username, email });
      msg.success(t('auth.validationCodeSent'));
      startCountdown();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        msg.error(String((e as Error).message));
      }
    } finally {
      setCodeSending(false);
    }
  };

  const onRegister = async () => {
    if (!regAgreed) return msg.warning(t('auth.pleaseAgreeTerms'));
    try {
      const values = await regForm.validateFields();
      if (needCode && !values.verificationCode) {
        return msg.warning(t('auth.pleaseEnterVerificationCode'));
      }
      await register(values.username, values.password, {
        email: values.email || undefined,
        phone: values.phone || undefined,
        nickname: values.nickname || undefined,
        verificationCode: values.verificationCode || undefined,
      });
      msg.success(t('auth.registerSuccess'));
      regForm.resetFields();
      setNeedCode(false);
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        const errMsg = String((e as Error).message);
        msg.error(errMsg);
        if (errMsg.includes('频繁') || errMsg.includes('验证码')) {
          setNeedCode(true);
        }
      }
    }
  };

  return (
    <div className="auth-background" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f7fa' }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>{t('auth.appName')}</Title>
          <Text type="secondary">{t('auth.appSubtitle')}</Text>
        </div>
        <Tabs
          centered
          destroyOnHidden={false}
          items={[
            {
              key: 'login',
              label: t('auth.login'),
              children: (
                <Form form={loginForm} layout="vertical" onFinish={onLogin} style={{ marginTop: 8 }}>
                  <Form.Item name="username" rules={[{ required: true, message: t('auth.enterUsername') }]}>
                    <Input prefix={<UserOutlined />} placeholder={t('auth.usernamePlaceholder')} size="large" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: t('auth.enterPassword') }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder={t('auth.passwordPlaceholder')} size="large" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading}>{t('auth.login')}</Button>
                  </Form.Item>
                  <Form.Item>
                    <Checkbox checked={loginAgreed} onChange={(e) => setLoginAgreed(e.target.checked)}>
                      {t('auth.agreedToTerms')} <Link to="/terms">{t('auth.serviceTerms')}</Link>
                    </Checkbox>
                  </Form.Item>
                  <Form.Item>
                    <Button block icon={<GithubOutlined />} loading={oauthLoading} onClick={handleGithubLogin}>
                      {t('auth.loginWithGithub')}
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: t('auth.register'),
              children: (
                <Form form={regForm} layout="vertical" onFinish={onRegister} style={{ marginTop: 8 }}>
                  {regStatus?.whitelistEnabled && (
                    <Alert
                      title={t('auth.registerEmailOnly')}
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Form.Item name="username" label={t('auth.username')} rules={[{ required: true, min: 3, max: 50, message: t('auth.usernameRule') }]}>
                    <Input prefix={<UserOutlined />} placeholder={t('auth.usernamePlaceholder')} size="large" />
                  </Form.Item>
                  <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, min: 6, message: t('auth.passwordRule') }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder={t('auth.passwordPlaceholder')} size="large" />
                  </Form.Item>
                  <Form.Item name="email" label={t('auth.email')} rules={[{ type: 'email', message: t('auth.enterEmail') }]}>
                    <Input prefix={<MailOutlined />} placeholder={t('auth.emailPlaceholder')} size="large" />
                  </Form.Item>
                  <Space orientation="vertical" style={{ width: '100%' }} size={0}>
                    <Form.Item name="phone"><Input prefix={<PhoneOutlined />} placeholder={t('auth.phonePlaceholder')} /></Form.Item>
                    <Form.Item name="nickname"><Input placeholder={t('auth.nicknamePlaceholder')} /></Form.Item>
                  </Space>

                  {needCode && (
                    <Alert
                      title={t('auth.rateLimitWarning')}
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  {needCode && (
                    <Form.Item label={t('auth.emailVerificationCodeLabel')} required>
                      <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="verificationCode" noStyle rules={[{ required: true, message: t('auth.pleaseEnterVerificationCode') }]}>
                          <Input
                            prefix={<SafetyOutlined />}
                            placeholder={t('auth.verificationCodePlaceholder')}
                            maxLength={6}
                            size="large"
                            style={{ flex: 1 }}
                          />
                        </Form.Item>
                        <Button
                          size="large"
                          disabled={countdown > 0}
                          loading={codeSending}
                          onClick={handleSendCode}
                          style={{ minWidth: 120 }}
                        >
                          {countdown > 0 ? `${countdown}s` : t('auth.getVerificationCode')}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  )}

                  {!needCode && regForm.getFieldValue('email') && (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, marginBottom: 16 }}
                      onClick={handleSendCode}
                      loading={codeSending}
                    >
                      {t('auth.needVerificationCode')}
                    </Button>
                  )}

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading}>{t('auth.register')}</Button>
                  </Form.Item>
                  <Form.Item>
                    <Checkbox checked={regAgreed} onChange={(e) => setRegAgreed(e.target.checked)}>
                      {t('auth.agreedToTerms')} <Link to="/terms">{t('auth.serviceTerms')}</Link>
                    </Checkbox>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
      <OAuthWaitingModal
        open={oauthOpen}
        error={oauthError}
        errorAction={oauthErrorAction}
        onCancel={() => setOauthOpen(false)}
        onRetry={() => {
          setOauthOpen(false);
          setTimeout(handleGithubLogin, 100);
        }}
        onRegister={() => {
          setOauthOpen(false);
          // 切到注册 Tab
        }}
      />
    </div>
  );
}
