import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { UserOutlined, AppstoreOutlined, MessageOutlined, DownloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { adminApi } from '../api/adminApi';

const { Text } = Typography;

export default function AdminDashboard() {
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
          <Text type="danger">无管理员权限</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">管理后台</h1>
        <p className="page-subtitle">审核主题、管理工单、查看统计数据</p>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}><Card><Statistic title="用户总数" value={stats?.userCount ?? '-'} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="主题包总数" value={stats?.themeCount ?? '-'} prefix={<AppstoreOutlined />} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="待审核" value={stats?.pendingReview ?? '-'} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="未处理工单" value={stats?.openTickets ?? '-'} prefix={<MessageOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="总下载量" value={stats?.totalDownloads ?? '-'} prefix={<DownloadOutlined />} /></Card></Col>
      </Row>
    </div>
  );
}