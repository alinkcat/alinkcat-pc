import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, Form, Input, Button, Tabs, Typography, Space, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, SafetyOutlined, GithubOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/authApi';
import { useMessage } from '../hooks/useMessage';
import { OAuthWaitingModal, startGithubOAuth } from '../components/OAuthLogin';
import type { RegisterStatus } from '../api/types';

const { Title, Text } = Typography;

export default function Auth() {
  const navigate = useNavigate();
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
        msg.success('GitHub 登录成功');
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
    if (!loginAgreed) return msg.warning('请先同意服务条款');
    try {
      const values = await loginForm.validateFields();
      await login(values.username, values.password);
      msg.success('登录成功');
      navigate('/profile');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        msg.error(String((e as Error).message), 4);
      } else {
        msg.error('登录失败，请检查用户名和密码');
      }
    }
  };

  const handleSendCode = async () => {
    try {
      const username = regForm.getFieldValue('username');
      const email = regForm.getFieldValue('email');
      if (!username) return msg.warning('请先填写用户名');
      if (!email) return msg.warning('请先填写邮箱');
      setCodeSending(true);
      await authApi.sendRegisterCode({ username, email });
      msg.success('验证码已发送至邮箱，请查收');
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
    if (!regAgreed) return msg.warning('请先同意服务条款');
    try {
      const values = await regForm.validateFields();
      if (needCode && !values.verificationCode) {
        return msg.warning('请输入验证码');
      }
      await register(values.username, values.password, {
        email: values.email || undefined,
        phone: values.phone || undefined,
        nickname: values.nickname || undefined,
        verificationCode: values.verificationCode || undefined,
      });
      msg.success('注册成功，请登录');
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
          <Title level={3} style={{ marginBottom: 4 }}>艾联猫</Title>
          <Text type="secondary">ailinkcat · 主题包管理平台</Text>
        </div>
        <Tabs
          centered
          destroyOnHidden={false}
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form form={loginForm} layout="vertical" onFinish={onLogin} style={{ marginTop: 8 }}>
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading}>登录</Button>
                  </Form.Item>
                  <Form.Item>
                    <Checkbox checked={loginAgreed} onChange={(e) => setLoginAgreed(e.target.checked)}>
                      我已阅读并同意 <Link to="/terms">服务条款</Link>
                    </Checkbox>
                  </Form.Item>
                  <Form.Item>
                    <Button block icon={<GithubOutlined />} loading={oauthLoading} onClick={handleGithubLogin}>
                      使用 GitHub 登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form form={regForm} layout="vertical" onFinish={onRegister} style={{ marginTop: 8 }}>
                  {regStatus?.whitelistEnabled && (
                    <Alert
                      message="仅支持部分邮箱域名注册"
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  <Form.Item name="username" label="用户名" rules={[{ required: true, min: 3, max: 50, message: '3-50 字符' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>
                  <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
                    <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
                  </Form.Item>
                  <Space orientation="vertical" style={{ width: '100%' }} size={0}>
                    <Form.Item name="phone"><Input prefix={<PhoneOutlined />} placeholder="手机号（可选）" /></Form.Item>
                    <Form.Item name="nickname"><Input placeholder="昵称（可选）" /></Form.Item>
                  </Space>

                  {needCode && (
                    <Alert
                      message="已触发频率限制，请先获取邮箱验证码完成注册"
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  {needCode && (
                    <Form.Item label="邮箱验证码" required>
                      <Space.Compact style={{ width: '100%' }}>
                        <Form.Item name="verificationCode" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                          <Input
                            prefix={<SafetyOutlined />}
                            placeholder="6 位验证码"
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
                          {countdown > 0 ? `${countdown}s` : '获取验证码'}
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
                      需要验证码？点击获取
                    </Button>
                  )}

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block size="large" loading={loading}>注册</Button>
                  </Form.Item>
                  <Form.Item>
                    <Checkbox checked={regAgreed} onChange={(e) => setRegAgreed(e.target.checked)}>
                      我已阅读并同意 <Link to="/terms">服务条款</Link>
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
