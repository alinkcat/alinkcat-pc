import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Table, Tag, Tabs, Empty, Modal,
} from 'antd';
import {
  TrophyOutlined, CheckCircleOutlined, GiftOutlined,
  FireOutlined, LoginOutlined,
} from '@ant-design/icons';
import { usePointsStore } from '../store/pointsStore';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';

const RECORD_TYPES: Record<number, { label: string; color: string }> = {
  1: { label: '签到', color: 'cyan' },
  2: { label: '邀请', color: 'magenta' },
  3: { label: '下载', color: 'green' },
  4: { label: '评分', color: 'gold' },
  5: { label: '收藏', color: 'orange' },
  6: { label: '工单', color: 'blue' },
  7: { label: '邀请奖励', color: 'purple' },
  8: { label: '会员', color: 'gold' },
  9: { label: '兑换', color: 'red' },
};

export default function Points() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { message: msg } = useMessage();
  const {
    balance, records, rules, rank, mallItems,
    fetchBalance, fetchRecords, fetchRules, fetchRank, fetchMall,
    checkin, exchange,
  } = usePointsStore();

  useEffect(() => {
    if (isLoggedIn) {
      fetchBalance().catch(() => {});
      fetchRecords().catch(() => {});
      fetchMall().catch(() => {});
    }
    fetchRules().catch(() => {});
    fetchRank(10).catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">积分中心</h1>
          <p className="page-subtitle">签到赚积分，兑换会员与特权</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <TrophyOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <div style={{ marginBottom: 16 }}>登录后可签到、查看积分流水和兑换权益</div>
          <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/auth')}>去登录</Button>
        </Card>
        <Card style={{ marginTop: 16 }}>
          <Tabs
            items={[
              { key: 'rules', label: '积分规则', children: rules.length === 0 ? <Empty description="暂无规则" /> : (
                <Table dataSource={rules} rowKey="id" size="small" pagination={false}
                  columns={[
                    { title: '类型', dataIndex: 'actionType', render: (t: number) => RECORD_TYPES[t]?.label || t },
                    { title: '基础积分', dataIndex: 'basePoints' },
                    { title: '每日上限', dataIndex: 'dailyLimit' },
                    { title: '倍率', dataIndex: 'multiplier', render: (v: number) => v > 1 ? `${v}x` : '-' },
                  ]} />
              )},
              { key: 'rank', label: '排行榜', children: rank.length === 0 ? <Empty description="暂无数据" /> : (
                <Table dataSource={rank} rowKey="userId" size="small" pagination={false}
                  columns={[
                    { title: '排名', render: (_, __, i) => i + 1, width: 60 },
                    { title: '用户', dataIndex: 'username' },
                    { title: '总积分', dataIndex: 'totalEarned', render: (v: number) => <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span> },
                  ]} />
              )},
            ]}
          />
        </Card>
      </div>
    );
  }

  const handleCheckin = async () => {
    try {
      const r = await checkin();
      msg.success(`签到成功！+${r.points} 积分，连续 ${r.streak} 天`);
    } catch (e) { msg.error(String(e)); }
  };

  const handleMallExchange = async (item: typeof mallItems[0]) => {
    if (!balance || balance.balance < item.pointsCost) {
      return msg.warning(`积分不足，需要 ${item.pointsCost} 积分`);
    }
    if (item.stock === 0) {
      return msg.warning('该商品已售罄');
    }
    Modal.confirm({
      title: '确认兑换',
      content: (
        <div>
          <p>确定要使用 <b style={{ color: '#faad14' }}>{item.pointsCost}</b> 积分兑换「<b>{item.name}</b>」吗？</p>
          <p style={{ fontSize: 12, color: '#999' }}>当前余额：{balance.balance} 积分</p>
        </div>
      ),
      okText: '确认兑换',
      cancelText: '取消',
      onOk: async () => {
        try {
          const r = await exchange(item.exchangeType, item.id);
          if (r.success) {
            msg.success(r.message || `兑换成功，当前余额 ${r.newBalance} 积分`);
            fetchBalance().catch(() => {});
            fetchMall().catch(() => {});
          } else {
            msg.warning(r.message);
          }
        } catch (e) { msg.error(String(e)); }
      },
    });
  };

  const recordColumns = [
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: (t: number) => { const info = RECORD_TYPES[t] || { label: '未知', color: 'default' }; return <Tag color={info.color}>{info.label}</Tag>; },
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '积分', dataIndex: 'amount', width: 80, render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}{v}</span> },
    { title: '余额', dataIndex: 'balance', width: 80 },
    { title: '时间', dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">积分中心</h1>
        <p className="page-subtitle">签到赚积分，兑换会员与特权</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="可用积分" value={balance?.balance ?? 0} prefix={<TrophyOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="累计获得" value={balance?.totalEarned ?? 0} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="本月获得" value={balance?.monthlyEarned ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card hoverable onClick={handleCheckin} style={{ textAlign: 'center' }}>
            {balance?.checkedInToday ? (
              <Statistic title="今日签到" value="已签到" prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
            ) : (
              <div>
                <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>每日签到</div>
                <Button type="primary" icon={<CheckCircleOutlined />}>签到 +10</Button>
              </div>
            )}
            {balance && balance.checkinStreak > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#faad14' }}>
                <FireOutlined /> 连续 {balance.checkinStreak} 天
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'records',
              label: '积分流水',
              children: (
                <Table
                  dataSource={records}
                  columns={recordColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                />
              ),
            },
            {
              key: 'exchange',
              label: '积分兑换',
              children: mallItems.length === 0 ? (
                <Empty description="暂无可兑换商品" />
              ) : (
                <Row gutter={[16, 16]}>
                  {mallItems.map((item) => (
                    <Col xs={24} sm={12} md={6} key={item.id}>
                      <Card hoverable onClick={() => handleMallExchange(item)} style={{ height: '100%' }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} />
                        ) : (
                          <GiftOutlined style={{ fontSize: 32, color: '#4F6EF7', marginBottom: 8 }} />
                        )}
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4, minHeight: 32 }}>{item.description}</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={{ color: '#faad14', fontWeight: 600 }}>{item.pointsCost} 积分</span>
                          {item.stock === 0 ? <Tag color="red">已售罄</Tag> : item.stock === -1 ? <Tag color="green">不限量</Tag> : <Tag>库存 {item.stock}</Tag>}
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'rules',
              label: '积分规则',
              children: rules.length === 0 ? <Empty description="暂无规则" /> : (
                <Table
                  dataSource={rules}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '类型', dataIndex: 'actionType', render: (t: number) => RECORD_TYPES[t]?.label || t },
                    { title: '基础积分', dataIndex: 'basePoints' },
                    { title: '每日上限', dataIndex: 'dailyLimit' },
                    { title: '倍率', dataIndex: 'multiplier', render: (v: number) => v > 1 ? `${v}x` : '-' },
                  ]}
                />
              ),
            },
            {
              key: 'rank',
              label: '排行榜',
              children: rank.length === 0 ? <Empty description="暂无数据" /> : (
                <Table
                  dataSource={rank}
                  rowKey="userId"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '排名', render: (_, __, i) => i + 1, width: 60 },
                    { title: '用户', dataIndex: 'username' },
                    { title: '总积分', dataIndex: 'totalEarned', render: (v: number) => <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span> },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
