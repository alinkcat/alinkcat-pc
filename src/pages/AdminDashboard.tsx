import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { UserOutlined, AppstoreOutlined, MessageOutlined, DownloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { adminApi } from '../api/adminApi';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<{
    userCount: number; themeCount: number; pendingReview: number;
    openTickets: number; totalDownloads: number;
  } | null>(null);

  useEffect(() => {
    adminApi.stats().then((resp) => {
      if (resp.code === 200) setStats(resp.data);
    }).catch(() => {});
  }, []);

  if (!profile || profile.roleCode !== 'ADMIN') {
    return (
      <div className="page-container">
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Text type="danger">{t('admin.noPermission')}</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('admin.title')}</h1>
        <p className="page-subtitle">{t('admin.subtitle')}</p>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}><Card><Statistic title={t('admin.stats.userCount')} value={stats?.userCount ?? '-'} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title={t('admin.stats.themeCount')} value={stats?.themeCount ?? '-'} prefix={<AppstoreOutlined />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title={t('admin.stats.pendingReview')} value={stats?.pendingReview ?? '-'} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title={t('admin.stats.openTickets')} value={stats?.openTickets ?? '-'} prefix={<MessageOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title={t('admin.stats.totalDownloads')} value={stats?.totalDownloads ?? '-'} prefix={<DownloadOutlined />} /></Card></Col>
      </Row>
    </div>
  );
}