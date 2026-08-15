import { useEffect } from 'react';
import { Card, Table, Tag, Button, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';
import type { NotificationItem } from '../api/types';

const { Text } = Typography;

const TYPE_TAG: Record<string, { color: string; label: string }> = {
  audit: { color: 'blue', label: '审核' },
  purchase: { color: 'green', label: '购买' },
  ticket: { color: 'orange', label: '工单' },
  points: { color: 'purple', label: '积分' },
  system: { color: 'default', label: '系统' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { message: msg } = useMessage();
  const { list, unread, loading, fetchList, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    if (isLoggedIn) fetchList().catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">登录后查看通知</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Button type="primary" onClick={() => navigate('/auth')}>去登录</Button>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: (t: string) => { const info = TYPE_TAG[t] || TYPE_TAG.system; return <Tag color={info.color}>{info.label}</Tag>; },
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    {
      title: '状态', dataIndex: 'isRead', width: 80,
      render: (v: number) => v ? <Text type="secondary">已读</Text> : <Tag color="red">未读</Tag>,
    },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', width: 80,
      render: (_: unknown, r: NotificationItem) => !r.isRead && (
        <Button size="small" onClick={() => markRead(r.id).then(() => msg.success('已标记为已读')).catch(() => {})}>标为已读</Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">通知中心</h1>
          <p className="page-subtitle">{unread > 0 ? `您有 ${unread} 条未读通知` : '暂无未读通知'}</p>
        </div>
        {unread > 0 && (
          <Button icon={<CheckOutlined />} onClick={() => markAllRead().then(() => msg.success('全部标为已读')).catch(() => {})}>
            全部标为已读
          </Button>
        )}
      </div>
      <Card>
        <Table
          dataSource={list}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
    </div>
  );
}