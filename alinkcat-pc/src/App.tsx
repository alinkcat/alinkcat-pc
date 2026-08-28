import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antTheme, Modal, Button, Typography, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './store/themeStore';
import { useI18nStore } from './i18n/useI18nStore';
import { APP_VERSION } from './config';
import { clientVersionApi } from './api/clientVersionApi';
import { initLogger } from './utils/logger';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import AuthExpiredModal from './components/AuthExpiredModal';
import VersionPolling from './components/VersionPolling';
import SplashScreen from './components/SplashScreen';
import MessageBinder from './utils/MessageBinder';
import Themes from './pages/Themes';
import Editor from './pages/Editor';
import Devices from './pages/Devices';
import Snippets from './pages/Snippets';
import Market from './pages/Market';
import MarketDetail from './pages/MarketDetail';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Terms from './pages/Terms';
import OAuthCallback from './pages/OAuthCallback';
import AdminDashboard from './pages/AdminDashboard';
import AdminThemeReview from './pages/AdminThemeReview';
import AdminTickets from './pages/AdminTickets';
import './styles.css';

const { Text, Title } = Typography;

interface Gate {
  type: 'deprecated' | 'maintenance' | 'force_update' | 'announcement';
  message: string;
  url?: string | null;
  changelog?: string | null;
  title?: string;
}

const SEEN_KEY = 'ilinkcat_seen_announcements';
function getSeenIds(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function markSeen(id: number) {
  const set = getSeenIds(); set.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
}

export default function App() {
  const { t } = useTranslation();
  const { mode, hydrate } = useThemeStore();
  const antdLocale = useI18nStore((s) => s.antdLocale);
  const [gate, setGate] = useState<Gate | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const checked = useRef(false);
  const retried = useRef(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const ONBOARDING_KEY = 'ilinkcat_onboarding_done';

  useEffect(() => { initLogger(); hydrate(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  // 启动时版本检查（只执行一次，防止 StrictMode 双调用）
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    let resolved = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    function allowEntry() {
      if (resolved) return;
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setAllowed(true);
    }

    function setGateOnce(g: Gate) {
      if (resolved) return;
      resolved = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setGate(g);
    }

    function doCheck() {
      clientVersionApi.check('windows', APP_VERSION)
        .then((resp) => {
          if (resp.code !== 200 || !resp.data) { allowEntry(); return; }
          const { version, announcements } = resp.data;

          if (version.status === 2) {
            setGateOnce({ type: 'deprecated', message: t('versionGate.deprecated'), url: version.updateUrl });
            return;
          }
          if (version.forceUpdate === 1) {
            setGateOnce({ type: 'force_update', message: t('versionGate.forceUpdate'), url: version.updateUrl, changelog: version.changelog });
            return;
          }
          if (version.status === 1) {
            setGateOnce({ type: 'maintenance', message: t('versionGate.maintenance'), url: version.updateUrl });
            return;
          }

          // 弹窗公告
          const seen = getSeenIds();
          const now = new Date().toISOString();
          const valid = announcements.filter((a) => {
            if (a.status !== 1) return false;
            if (a.targetPlatform && a.targetPlatform !== 'windows') return false;
            if (a.popupType === 'once' && seen.has(a.id)) return false;
            if (a.startAt && a.startAt > now) return false;
            if (a.endAt && a.endAt < now) return false;
            return true;
          });
          if (valid.length > 0) {
            const a = valid[0];
            markSeen(a.id);
            setGateOnce({ type: 'announcement', title: a.title, message: a.content || '' });
            return;
          }

          allowEntry();
        })
        .catch(() => {
          if (!retried.current) {
            retried.current = true;
            // 30 秒后重试一次
            retryTimer = setTimeout(() => { doCheck(); }, 30000);
            // 安全兜底：若重试请求悬挂超过 60 秒仍未完成则放行
            fallbackTimer = setTimeout(() => { allowEntry(); }, 60000);
          } else {
            allowEntry();
          }
        });
    }

    doCheck();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  // 检测首次启动，显示引导弹窗
  useEffect(() => {
    if (allowed) {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setOnboardingOpen(true);
      }
    }
  }, [allowed]);

  const ONBOARDING_STEPS = [
    {
      emoji: '👋',
      title: t('onboarding.welcome.title'),
      desc: t('onboarding.welcome.desc'),
      img: '🎨',
    },
    {
      emoji: '📋',
      title: t('onboarding.template.title'),
      desc: t('onboarding.template.desc'),
      img: '📁',
    },
    {
      emoji: '📱',
      title: t('onboarding.push.title'),
      desc: t('onboarding.push.desc'),
      img: '📲',
    },
  ];

  const handleOnboardingFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setOnboardingOpen(false);
    setOnboardingStep(0);
  };

  const handleOnboardingSkip = () => {
    handleOnboardingFinish();
  };

  const isDark = mode === 'dark';

  const closeGate = () => { setGate(null); setAllowed(true); };
  const handleBlocking = () => {
    if (gate?.url) window.open(gate.url, '_blank');
    window.close();
  };

  const isBlocking = gate?.type === 'deprecated' || gate?.type === 'force_update';

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: { colorPrimary: '#4F6EF7' },
      }}
    >
      <AntApp>
        <MessageBinder />
        {!splashDone && <SplashScreen onFinished={() => setSplashDone(true)} />}
        {gate && (
          <Modal open closable={!isBlocking} mask={{ closable: !isBlocking }} keyboard={false} footer={null} width={400} centered onCancel={closeGate}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {gate.type === 'announcement' ? '📢' : gate.type === 'deprecated' ? '🚫' : '⬆️'}
              </div>
              <Text strong style={{ fontSize: 16 }}>{gate.title || (isBlocking ? t('versionGate.titleUpdate') : t('versionGate.titleMaintenance'))}</Text>
              <div style={{ marginTop: 12 }}><Text style={{ whiteSpace: 'pre-wrap' }}>{gate.message}</Text></div>
              {gate.changelog && (
                <div style={{ marginTop: 12, padding: 8, background: '#f5f5f5', borderRadius: 6, textAlign: 'left' }}>
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{gate.changelog}</Text>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                {isBlocking ? (
                  <Space>
                    {gate.url && <Button type="primary" onClick={handleBlocking}>{t('versionGate.downloadUpdate')}</Button>}
                    <Button onClick={handleBlocking}>{t('versionGate.exitApp')}</Button>
                  </Space>
                ) : (
                  <Button type="primary" onClick={closeGate}>{t('versionGate.gotIt')}</Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {allowed && (
          <ErrorBoundary>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<Navigate to="/themes" replace />} />
                  <Route path="themes" element={<Themes />} />
                  <Route path="themes/edit/:id" element={<Editor />} />
                  <Route path="devices" element={<Devices />} />
                  <Route path="snippets" element={<Snippets />} />
                  <Route path="market" element={<Market />} />
                  <Route path="market/:id" element={<MarketDetail />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="auth" element={<Auth />} />
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="admin/themes" element={<AdminThemeReview />} />
                  <Route path="admin/tickets" element={<AdminTickets />} />
                </Route>
                <Route path="/oauth/callback" element={<OAuthCallback />} />
              <Route path="/terms" element={<Terms />} />
              </Routes>
              <AuthExpiredModal />
              <VersionPolling />
            </BrowserRouter>
          </ErrorBoundary>
        )}

        {/* 首次使用引导弹窗 */}
        <Modal
          open={onboardingOpen}
          closable={false}
          mask={{ closable: false }}
          keyboard={false}
          footer={null}
          width={420}
          centered
          destroyOnHidden
        >
          <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {ONBOARDING_STEPS[onboardingStep].img}
            </div>
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              {ONBOARDING_STEPS[onboardingStep].title}
            </Title>
            <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {ONBOARDING_STEPS[onboardingStep].desc}
            </Text>
          </div>
          {/* 步骤指示器 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === onboardingStep ? '#4F6EF7' : '#d9d9d9',
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="text" onClick={handleOnboardingSkip}>
              {t('onboarding.skip')}
            </Button>
            <Space>
              <Button disabled={onboardingStep === 0} onClick={() => setOnboardingStep(s => s - 1)}>
                {t('back')}
              </Button>
              {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                <Button type="primary" onClick={() => setOnboardingStep(s => s + 1)}>
                  {t('onboarding.next')}
                </Button>
              ) : (
                <Button type="primary" onClick={handleOnboardingFinish}>
                  {t('onboarding.start')}
                </Button>
              )}
            </Space>
          </div>
        </Modal>
      </AntApp>
    </ConfigProvider>
  );
}