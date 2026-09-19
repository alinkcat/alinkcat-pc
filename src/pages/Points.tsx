import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/setup';
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
  1: { label: i18n.t('points.record_type_1'), color: 'cyan' },
  2: { label: i18n.t('points.record_type_2'), color: 'magenta' },
  3: { label: i18n.t('points.record_type_3'), color: 'green' },
  4: { label: i18n.t('points.record_type_4'), color: 'gold' },
  5: { label: i18n.t('points.record_type_5'), color: 'orange' },
  6: { label: i18n.t('points.record_type_6'), color: 'blue' },
  7: { label: i18n.t('points.record_type_7'), color: 'purple' },
  8: { label: i18n.t('points.record_type_8'), color: 'gold' },
  9: { label: i18n.t('points.record_type_9'), color: 'red' },
};

export default function Points() {
  const { t } = useTranslation();
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
          <h1 className="page-title">{t('points.title')}</h1>
          <p className="page-subtitle">{t('points.subtitle')}</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <TrophyOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <div style={{ marginBottom: 16 }}>{t('points.loginHint')}</div>
          <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/auth')}>{t('points.loginRequired')}</Button>
        </Card>
        <Card style={{ marginTop: 16 }}>
          <Tabs
            items={[
              { key: 'rules', label: t('points.pointsRules'), children: rules.length === 0 ? <Empty description={t('points.noRules')} /> : (
                <Table dataSource={rules} rowKey="id" size="small" pagination={false}
                  columns={[
                    { title: t('points.actionType'), dataIndex: 'actionType', render: (type: number) => RECORD_TYPES[type]?.label || type },
                    { title: t('points.basePoints'), dataIndex: 'basePoints' },
                    { title: t('points.dailyLimit'), dataIndex: 'dailyLimit' },
                    { title: t('points.multiplier'), dataIndex: 'multiplier', render: (v: number) => v > 1 ? t('points.multiplierValue', { value: v }) : '-' },
                  ]} />
              )},
              { key: 'rank', label: t('points.rank'), children: rank.length === 0 ? <Empty description={t('points.noRecords')} /> : (
                <Table dataSource={rank} rowKey="userId" size="small" pagination={false}
                  columns={[
                    { title: t('points.rankNo'), render: (_, __, i) => i + 1, width: 60 },
                    { title: t('points.username'), dataIndex: 'username' },
                    { title: t('points.totalPoints'), dataIndex: 'totalEarned', render: (v: number) => <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span> },
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
      msg.success(t('points.checkinSuccess', { points: r.points, streak: r.streak }));
    } catch (e) { msg.error(String(e)); }
  };

  const handleMallExchange = async (item: typeof mallItems[0]) => {
    if (!balance || balance.balance < item.pointsCost) {
      return msg.warning(t('points.insufficientPoints', { points: item.pointsCost }));
    }
    if (item.stock === 0) {
      return msg.warning(t('points.itemOutOfStock'));
    }
    Modal.confirm({
      title: t('points.confirmExchange'),
      content: (
        <div>
          <p>{t('points.confirmExchangeContent', { points: item.pointsCost, name: item.name })}</p>
          <p style={{ fontSize: 12, color: '#999' }}>{t('points.currentBalance', { balance: balance.balance })}</p>
        </div>
      ),
      okText: t('points.exchangeConfirm'),
      cancelText: t('points.cancel'),
      onOk: async () => {
        try {
          const r = await exchange(item.exchangeType, item.id);
          if (r.success) {
            msg.success(r.message || t('points.exchangeSuccess', { balance: r.newBalance }));
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
      title: t('points.type'), dataIndex: 'type', width: 80,
      render: (type: number) => { const info = RECORD_TYPES[type] || { label: t('points.unknownType'), color: 'default' }; return <Tag color={info.color}>{info.label}</Tag>; },
    },
    { title: t('points.description'), dataIndex: 'description', ellipsis: true },
    { title: t('points.points'), dataIndex: 'amount', width: 80, render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>{v > 0 ? '+' : ''}{v}</span> },
    { title: t('points.balance'), dataIndex: 'balance', width: 80 },
    { title: t('points.time'), dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('points.title')}</h1>
        <p className="page-subtitle">{t('points.subtitle')}</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('points.availablePoints')} value={balance?.balance ?? 0} prefix={<TrophyOutlined style={{ color: '#faad14' }} />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('points.totalEarned')} value={balance?.totalEarned ?? 0} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t('points.monthlyEarned')} value={balance?.monthlyEarned ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card hoverable onClick={handleCheckin} style={{ textAlign: 'center' }}>
            {balance?.checkedInToday ? (
              <Statistic title={t('points.dailyCheckin')} value={t('points.checkedIn')} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
            ) : (
              <div>
                <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', marginBottom: 4 }}>{t('points.dailyCheckin')}</div>
                <Button type="primary" icon={<CheckCircleOutlined />}>{t('points.checkin')}</Button>
              </div>
            )}
            {balance && balance.checkinStreak > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#faad14' }}>
                <FireOutlined /> {t('points.checkinStreak', { count: balance.checkinStreak })}
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
              label: t('points.pointsRecords'),
              children: (
                <Table
                  dataSource={records}
                  columns={recordColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10, showTotal: (total) => t('points.totalCount', { total }) }}
                />
              ),
            },
            {
              key: 'exchange',
              label: t('points.pointsExchange'),
              children: mallItems.length === 0 ? (
                <Empty description={t('points.noMallItems')} />
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
                          <span style={{ color: '#faad14', fontWeight: 600 }}>{t('points.pointsCost', { points: item.pointsCost })}</span>
                          {item.stock === 0 ? <Tag color="red">{t('points.outOfStock')}</Tag> : item.stock === -1 ? <Tag color="green">{t('points.unlimited')}</Tag> : <Tag>{t('points.stock', { count: item.stock })}</Tag>}
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'rules',
              label: t('points.pointsRules'),
              children: rules.length === 0 ? <Empty description={t('points.noRules')} /> : (
                <Table
                  dataSource={rules}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: t('points.actionType'), dataIndex: 'actionType', render: (type: number) => RECORD_TYPES[type]?.label || type },
                    { title: t('points.basePoints'), dataIndex: 'basePoints' },
                    { title: t('points.dailyLimit'), dataIndex: 'dailyLimit' },
                    { title: t('points.multiplier'), dataIndex: 'multiplier', render: (v: number) => v > 1 ? t('points.multiplierValue', { value: v }) : '-' },
                  ]}
                />
              ),
            },
            {
              key: 'rank',
              label: t('points.rank'),
              children: rank.length === 0 ? <Empty description={t('points.noRecords')} /> : (
                <Table
                  dataSource={rank}
                  rowKey="userId"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: t('points.rankNo'), render: (_, __, i) => i + 1, width: 60 },
                    { title: t('points.username'), dataIndex: 'username' },
                    { title: t('points.totalPoints'), dataIndex: 'totalEarned', render: (v: number) => <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span> },
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
