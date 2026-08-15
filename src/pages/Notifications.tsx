import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Tag, Button, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';
import type { NotificationItem } from '../api/types';

const { Text } = Typography;

export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { message: msg } = useMessage();
  const { list, unread, loading, fetchList, markRead, markAllRead } = useNotificationStore();

  const TYPE_TAG: Record<string, { color: string; label: string }> = {
    audit: { color: 'blue', label: t('notifications.type_audit') },
    purchase: { color: 'green', label: t('notifications.type_purchase') },
    ticket: { color: 'orange', label: t('notifications.type_ticket') },
    points: { color: 'purple', label: t('notifications.type_points') },
    system: { color: 'default', label: t('notifications.type_system') },
  };

  useEffect(() => {
    if (isLoggedIn) fetchList().catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('notifications.title')}</h1>
          <p className="page-subtitle">{t('notifications.subtitle')}</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Button type="primary" onClick={() => navigate('/auth')}>{t('notifications.goLogin')}</Button>
        </Card>
      </div>
    );
  }

  const columns = [
    {
      title: t('notifications.type'), dataIndex: 'type', width: 80,
      render: (type: string) => { const info = TYPE_TAG[type] || TYPE_TAG.system; return <Tag color={info.color}>{info.label}</Tag>; },
    },
    { title: t('notifications.title'), dataIndex: 'title', ellipsis: true },
    { title: t('notifications.content'), dataIndex: 'content', ellipsis: true },
    {
      title: t('notifications.status'), dataIndex: 'isRead', width: 80,
      render: (v: number) => v ? <Text type="secondary">{t('notifications.read')}</Text> : <Tag color="red">{t('notifications.unread')}</Tag>,
    },
    { title: t('notifications.time'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('notifications.actions'), width: 80,
      render: (_: unknown, r: NotificationItem) => !r.isRead && (
        <Button size="small" onClick={() => markRead(r.id).then(() => msg.success(t('notifications.markedRead'))).catch(() => {})}>{t('notifications.markRead')}</Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{t('notifications.title')}</h1>
          <p className="page-subtitle">{unread > 0 ? t('notifications.unread', { count: unread }) : t('notifications.noUnread')}</p>
        </div>
        {unread > 0 && (
          <Button icon={<CheckOutlined />} onClick={() => markAllRead().then(() => msg.success(t('notifications.allMarkedRead'))).catch(() => {})}>
            {t('notifications.markAllRead')}
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
          pagination={{ pageSize: 15, showTotal: (total: number) => t('notifications.totalCount', { total }) }}
        />
      </Card>
    </div>
  );
}