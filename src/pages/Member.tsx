import { useTranslation } from 'react-i18next';
import i18n from '../i18n/setup';
import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Table, Tag, Input, Typography, Space, Empty, Avatar, Alert, Modal,
} from 'antd';
import { message } from '../utils/message';
import {
  CrownOutlined, UserOutlined, CloudOutlined, KeyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useMemberStore } from '../store/memberStore';
import { useAuthStore } from '../store/authStore';
import { usePointsStore } from '../store/pointsStore';
import { weatherApi, extractKey } from '../api/weatherApi';
import type { WeatherKeyInfo } from '../api/weatherApi';
import { useNavigate } from 'react-router-dom';
import BenefitsComparison from '../components/BenefitsComparison';

const { Title, Text } = Typography;

const PLAN_COLORS: Record<number, string> = { 1: '#faad14', 2: '#722ed1' };

// 天气 Key 本地持久化（仅存"已申请"标记，不存明文；明文只展示一次后即丢）
const WEATHER_KEY_STORAGE = 'ilinkcat_weather_key';

function hasStoredWeatherKey(): boolean {
  try { return localStorage.getItem(WEATHER_KEY_STORAGE) === '1'; } catch { return false; }
}

function markWeatherKeyApplied() {
  try { localStorage.setItem(WEATHER_KEY_STORAGE, '1'); } catch { /* ignore */ }
}

function clearWeatherKeyMarker() {
  try { localStorage.removeItem(WEATHER_KEY_STORAGE); } catch { /* ignore */ }
}

function parseBenefits(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function renderBenefits(benefits: string): React.ReactNode {
  const b = parseBenefits(benefits);
  const items: string[] = [];
  if (b.cloudStorage) items.push(i18n.t('member.benefits_cloudStorage'));
  if (b.aiChat) items.push(i18n.t('member.benefits_aiChat', { count: b.aiChat }));
  if (b.noAds) items.push(i18n.t('member.benefits_noAds'));
  if (b.fastDownload) items.push(i18n.t('member.benefits_fastDownload'));
  if (b.customTheme) items.push(i18n.t('member.benefits_customTheme'));
  if (b.dataExport) items.push(i18n.t('member.benefits_dataExport'));
  if (b.prioritySupport) items.push(i18n.t('member.benefits_prioritySupport'));
  if (b.multiDevice) items.push(i18n.t('member.benefits_multiDevice'));
  return items.length > 0 ? items.join('、') : i18n.t('member.benefits_all');
}

export default function Member() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, profile } = useAuthStore();
  const { plans, member, comparison, orders, fetchPlans, fetchMy, fetchComparison, fetchOrders, createOrder, redeemCard } = useMemberStore();
  const { balance, fetchBalance } = usePointsStore();
  const [cardCode, setCardCode] = useState('');
  // 服务端返回的天气 Key 状态（status 接口为准）
  const [weatherInfo, setWeatherInfo] = useState<WeatherKeyInfo | null>(null);
  // 本地"已申请"标记（status 接口异常时兜底展示已申请，避免误显示"未申请"）
  const [hasFallbackKey, setHasFallbackKey] = useState(hasStoredWeatherKey());
  // 申请/重置后返回的明文 Key（仅本次展示，提示用户复制保存）
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [applyingWeather, setApplyingWeather] = useState(false);
  const [resettingWeather, setResettingWeather] = useState(false);

  const STATUS_MAP: Record<number, { text: string; color: string }> = {
    0: { text: t('member.paymentUnpaid'), color: 'default' },
    1: { text: t('member.paymentPaid'), color: 'success' },
  };

  useEffect(() => {
    fetchPlans().catch(() => {});
    fetchComparison().catch(() => {});
    if (isLoggedIn) {
      fetchMy().catch(() => {});
      fetchComparison().catch(() => {});
      fetchOrders().catch(() => {});
      fetchBalance().catch(() => {});
    }
  }, [isLoggedIn]);

  // 加载当前天气 Key 状态（token 为掩码）。依赖 isLoggedIn：登录态变化后重新拉取，
  // 避免未登录时 401 被吞掉导致登录成功后仍显示"未申请"。
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    // 本地已保存的 Key 兜底：仅作"已申请"占位，避免 status 接口异常时误显示"未申请"。
    // 注意：这里不把明文 Key 渲染到最终显示层（见下），仅用于状态兜底。
    setHasFallbackKey(hasStoredWeatherKey());
    weatherApi.status()
      .then((resp) => {
        if (cancelled) return;
        if (resp.code === 200) {
          // 后端明确无 Key → 清除本地兜底，回到"未申请"（避免展示已吊销/无效的旧 Key）
          if (!resp.data) {
            clearWeatherKeyMarker();
            setHasFallbackKey(false);
            setWeatherInfo(null);
          } else {
            // status 返回的是掩码 token，直接渲染，不要覆盖为明文
            setHasFallbackKey(false);
            setWeatherInfo(resp.data);
          }
        }
        // 非 200（网���/未登录）：保留本地兜底占位不降级
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  const handleApplyWeather = async () => {
    setApplyingWeather(true);
    try {
      const resp = await weatherApi.apply();
      if (resp.code !== 200) throw new Error(resp.message);
      setWeatherInfo(resp.data);
      const key = extractKey(resp.data);
      if (key) markWeatherKeyApplied();
      setFreshToken(key);
      message.success(t('member.weather_applied'));
    } catch (e) { message.error(String(e)); } finally {
      setApplyingWeather(false);
    }
  };

  const handleResetWeather = () => {
    Modal.confirm({
      title: t('member.weather_reset_title'),
      content: t('member.weather_reset_desc'),
      okText: t('member.weather_reset'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        setResettingWeather(true);
        try {
          const resp = await weatherApi.reset();
          if (resp.code !== 200) throw new Error(resp.message);
          setWeatherInfo(resp.data);
          const key = extractKey(resp.data);
          if (key) markWeatherKeyApplied();
          setFreshToken(key);
          message.success(t('member.weather_reset_success'));
        } catch (e) { message.error(String(e)); } finally {
          setResettingWeather(false);
        }
      },
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('member.title')}</h1>
          <p className="page-subtitle">{t('member.subtitleNotLoggedIn')}</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <CrownOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <div><Button type="primary" onClick={() => navigate('/auth')}>{t('member.loginRequired')}</Button></div>
        </Card>
      </div>
    );
  }

  const handleBuy = async (planId: number) => {
    try {
      const order = await createOrder(planId, 'easypay');
      message.success(t('member.orderCreated', { orderNo: order.orderNo }));
      fetchMy().catch(() => {});
    } catch (e) { message.error(String(e)); }
  };

  const handleRedeem = async () => {
    if (!cardCode.trim()) return message.warning(t('member.cardRedeemHint'));
    try {
      await redeemCard(cardCode.trim());
      message.success(t('member.redeemSuccess'));
      setCardCode('');
    } catch (e) { message.error(String(e)); }
  };

  const pointsForExchange = (type: number) => type === 1 ? 2000 : type === 2 ? 20000 : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('member.title')}</h1>
        <p className="page-subtitle">{t('member.subtitle')}</p>
      </div>

      {/* User info */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Avatar
              size={56}
              src={profile?.avatar}
              icon={<UserOutlined />}
              style={{ background: '#4F6EF7' }}
            />
          </Col>
          <Col flex="auto">
            <div style={{ fontSize: 16, fontWeight: 600 }}>{profile?.nickname || profile?.username || t('member.userInfo')}</div>
            <div style={{ color: '#999', fontSize: 13 }}>
              {profile?.roleName && <Tag color="gold" style={{ marginRight: 8 }}>{profile.roleName}</Tag>}
              {profile?.email || ''}
            </div>
          </Col>
          <Col>
            <Button onClick={() => navigate('/profile')}>{t('member.profile')}</Button>
          </Col>
        </Row>
      </Card>

      {/* 天气服务（申请天气 Key） */}
      <Card
        style={{ marginBottom: 16 }}
        title={<span><CloudOutlined style={{ marginRight: 8 }} />{t('member.weather_service')}</span>}
      >
        {freshToken ? (
          /* 刚申请/重置：展示完整 Key 仅一次（引用后端 warning 文案） */
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="warning"
              showIcon
              message={t('member.weather_show_once_title')}
              description={weatherInfo?.warning || t('member.weather_show_once_desc')}
            />
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{t('member.weather_key')}</div>
              <Typography.Text
                code
                copyable={{ text: freshToken }}
                style={{ fontSize: 12, wordBreak: 'break-all', display: 'block' }}
              >
                {freshToken}
              </Typography.Text>
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {t('member.weather_android_hint')}
            </div>
            <Space>
              <Button type="primary" onClick={() => setFreshToken(null)}>
                {t('member.weather_saved')}
              </Button>
              <Button
                danger
                icon={<ReloadOutlined />}
                loading={resettingWeather}
                onClick={handleResetWeather}
              >
                {t('member.weather_reset')}
              </Button>
            </Space>
          </Space>
        ) : weatherInfo ? (
          /* 已有 Key：展示掩码、用量（可选）、重置 */
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="success"
              showIcon
              message={t('member.weather_key_active')}
              description={
                <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                  <div>
                    <b>{t('member.weather_key')}：</b>
                    <Typography.Text code style={{ fontSize: 12 }}>
                      {weatherInfo.apiKey || weatherInfo.token || ''}
                    </Typography.Text>
                  </div>
                  {weatherInfo.dailyLimit != null && (
                    <div style={{ marginTop: 4 }}>
                      <b>{t('member.weather_daily_limit')}：</b>
                      {weatherInfo.usedToday ?? '--'} / {weatherInfo.dailyLimit}
                    </div>
                  )}
                </div>
              }
            />
            <div style={{ fontSize: 12, color: '#999' }}>
              {t('member.weather_android_hint')}
            </div>
            <Button
              danger
              icon={<ReloadOutlined />}
              loading={resettingWeather}
              onClick={handleResetWeather}
            >
              {t('member.weather_reset')}
            </Button>
          </Space>
        ) : hasFallbackKey ? (
          /* 本地兜底：已申请过但 status 接口暂不可用 → 不降级为"未申请"，提示稍后刷新 */
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="success"
              showIcon
              message={t('member.weather_key_active')}
              description={t('member.weather_fallback_desc')}
            />
            <div style={{ fontSize: 12, color: '#999' }}>
              {t('member.weather_android_hint')}
            </div>
            <Button
              danger
              icon={<ReloadOutlined />}
              loading={resettingWeather}
              onClick={handleResetWeather}
            >
              {t('member.weather_reset')}
            </Button>
          </Space>
        ) : (
          /* 未申请：显示申请按钮 */
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="info"
              showIcon
              message={t('member.weather_apply_hint')}
              description={t('member.weather_apply_desc')}
            />
            <Button
              type="primary"
              icon={<KeyOutlined />}
              loading={applyingWeather}
              onClick={handleApplyWeather}
            >
              {t('member.weather_apply')}
            </Button>
          </Space>
        )}
      </Card>

      {/* Current membership status */}
      {member && (
        <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff' }}>
          <Row gutter={16} align="middle">
            <Col>
              <CrownOutlined style={{ fontSize: 40, color: PLAN_COLORS[member.level] || '#faad14' }} />
            </Col>
            <Col flex="auto">
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
                {plans.find(p => p.id === member.planId)?.name || t('member.membership')}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {t('member.validUntil', { date: new Date(member.endDate).toLocaleDateString() })}
              </div>
            </Col>
            <Col>
              <Tag color={new Date(member.endDate) > new Date() ? 'success' : 'default'}>
                {new Date(member.endDate) > new Date() ? t('member.active') : t('member.expired')}
              </Tag>
            </Col>
          </Row>
        </Card>
      )}

      {/* Plans */}
      <Row gutter={[16, 16]}>
        {plans.map((plan) => (
          <Col xs={24} md={12} key={plan.id}>
            <Card
              hoverable
              style={{ borderTop: `3px solid ${PLAN_COLORS[plan.level] || '#4F6EF7'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={4} style={{ marginBottom: 4 }}>{plan.name}</Title>
                  <Text type="secondary">{plan.description}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: PLAN_COLORS[plan.level] || '#4F6EF7' }}>
                    ¥{plan.price}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>{t('member.days', { days: plan.durationDays })}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                  {renderBenefits(plan.benefits)}
                </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Button type="primary" block onClick={() => handleBuy(plan.id)}>{t('member.buy')}</Button>
                <Button
                  block
                  disabled={!balance || balance.balance < pointsForExchange(plan.level === 1 ? 1 : 2)}
                  onClick={async () => {
                    try {
                      const { exchange } = usePointsStore.getState();
                      const r = await exchange(plan.level === 1 ? 1 : 2);
                      if (r.success) { message.success(r.message); fetchMy().catch(() => {}); }
                      else message.warning(r.message);
                    } catch (e) { message.error(String(e)); }
                  }}
                >
                  {t('member.pointsExchange', { points: pointsForExchange(plan.level === 1 ? 1 : 2) })}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Card redeem */}
      <Card title={t('member.cardRedeem')} style={{ marginTop: 16 }}>
        <Space>
          <Input
            placeholder={t('member.cardPlaceholder')}
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value)}
            style={{ width: 300 }}
          />
          <Button type="primary" onClick={handleRedeem}>{t('member.redeem')}</Button>
        </Space>
      </Card>

      {/* Benefits Comparison */}
      <BenefitsComparison data={comparison} />

      {/* Order history */}
      <Card title={t('member.orderHistory')} style={{ marginTop: 16 }}>
        {orders.length === 0 ? (
          <Empty description={t('member.noOrders')} />
        ) : (
          <Table
            dataSource={orders}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: t('member.orderNo'), dataIndex: 'orderNo', width: 200 },
              { title: t('member.amount'), dataIndex: 'amount', width: 100, render: (v: number) => `¥${v}` },
              { title: t('member.paymentMethod'), dataIndex: 'paymentMethod', width: 100 },
              {
                title: t('member.status'), dataIndex: 'status', width: 100,
                render: (s: number) => { const info = STATUS_MAP[s] || { text: t('member.paymentUnknown'), color: 'default' }; return <Tag color={info.color}>{info.text}</Tag>; },
              },
              { title: t('member.paidAt'), dataIndex: 'paidAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
