import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Table, Tag, Input, Typography, Space, Empty, message, Avatar,
} from 'antd';
import {
  CrownOutlined, UserOutlined,
} from '@ant-design/icons';
import { useMemberStore } from '../store/memberStore';
import { useAuthStore } from '../store/authStore';
import { usePointsStore } from '../store/pointsStore';
import { useNavigate } from 'react-router-dom';
import BenefitsComparison from '../components/BenefitsComparison';

const { Title, Text } = Typography;

const PLAN_COLORS: Record<number, string> = { 1: '#faad14', 2: '#722ed1' };
const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '待支付', color: 'default' },
  1: { text: '已支付', color: 'success' },
};

function parseBenefits(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function renderBenefits(benefits: string): React.ReactNode {
  const b = parseBenefits(benefits);
  const items: string[] = [];
  if (b.cloudStorage) items.push('云盘备份');
  if (b.aiChat) items.push(`AI 对话 ×${b.aiChat}`);
  if (b.noAds) items.push('免广告');
  if (b.fastDownload) items.push('极速下载');
  if (b.customTheme) items.push('自定义主题');
  if (b.dataExport) items.push('数据导出');
  if (b.prioritySupport) items.push('优先客服');
  if (b.multiDevice) items.push('多设备同步');
  return items.length > 0 ? items.join('、') : '解锁所有高级主题包';
}

export default function Member() {
  const navigate = useNavigate();
  const { isLoggedIn, profile } = useAuthStore();
  const { plans, member, comparison, orders, fetchPlans, fetchMy, fetchComparison, fetchOrders, createOrder, redeemCard } = useMemberStore();
  const { balance, fetchBalance } = usePointsStore();
  const [cardCode, setCardCode] = useState('');

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

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">会员中心</h1>
          <p className="page-subtitle">登录后查看会员信息</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <CrownOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <div><Button type="primary" onClick={() => navigate('/auth')}>去登录</Button></div>
        </Card>
      </div>
    );
  }

  const handleBuy = async (planId: number) => {
    try {
      const order = await createOrder(planId, 'easypay');
      message.success(`订单创建成功: ${order.orderNo}`);
      fetchMy().catch(() => {});
    } catch (e) { message.error(String(e)); }
  };

  const handleRedeem = async () => {
    if (!cardCode.trim()) return message.warning('请输入卡密');
    try {
      await redeemCard(cardCode.trim());
      message.success('兑换成功！');
      setCardCode('');
    } catch (e) { message.error(String(e)); }
  };

  const pointsForExchange = (type: number) => type === 1 ? 2000 : type === 2 ? 20000 : 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">会员中心</h1>
        <p className="page-subtitle">解锁高级主题包与专属特权</p>
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
            <div style={{ fontSize: 16, fontWeight: 600 }}>{profile?.nickname || profile?.username || '用户'}</div>
            <div style={{ color: '#999', fontSize: 13 }}>
              {profile?.roleName && <Tag color="gold" style={{ marginRight: 8 }}>{profile.roleName}</Tag>}
              {profile?.email || ''}
            </div>
          </Col>
          <Col>
            <Button onClick={() => navigate('/profile')}>个人中心</Button>
          </Col>
        </Row>
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
                {plans.find(p => p.id === member.planId)?.name || '会员'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                有效期至 {new Date(member.endDate).toLocaleDateString()}
              </div>
            </Col>
            <Col>
              <Tag color={new Date(member.endDate) > new Date() ? 'success' : 'default'}>
                {new Date(member.endDate) > new Date() ? '生效中' : '已过期'}
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
                  <div style={{ fontSize: 12, color: '#999' }}>{plan.durationDays} 天</div>
                </div>
              </div>
              <div style={{ marginTop: 16, color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                  {renderBenefits(plan.benefits)}
                </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Button type="primary" block onClick={() => handleBuy(plan.id)}>购买</Button>
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
                  {pointsForExchange(plan.level === 1 ? 1 : 2)} 积分兑换
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Card redeem */}
      <Card title="卡密兑换" style={{ marginTop: 16 }}>
        <Space>
          <Input
            placeholder="输入卡密，如 ALCX7K2M9F4R1Q3"
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value)}
            style={{ width: 300 }}
          />
          <Button type="primary" onClick={handleRedeem}>兑换</Button>
        </Space>
      </Card>

      {/* Benefits Comparison */}
      <BenefitsComparison data={comparison} />

      {/* Order history */}
      <Card title="我的订单" style={{ marginTop: 16 }}>
        {orders.length === 0 ? (
          <Empty description="暂无订单" />
        ) : (
          <Table
            dataSource={orders}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '订单号', dataIndex: 'orderNo', width: 200 },
              { title: '金额', dataIndex: 'amount', width: 100, render: (v: number) => `¥${v}` },
              { title: '支付方式', dataIndex: 'paymentMethod', width: 100 },
              {
                title: '状态', dataIndex: 'status', width: 100,
                render: (s: number) => { const info = STATUS_MAP[s] || { text: '未知', color: 'default' }; return <Tag color={info.color}>{info.text}</Tag>; },
              },
              { title: '支付时间', dataIndex: 'paidAt', width: 160, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
