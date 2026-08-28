import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, Modal, Input } from 'antd';
import { message } from '../utils/message';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { adminApi } from '../api/adminApi';
import { useAuthStore } from '../store/authStore';
import type { ThemeItem } from '../api/types';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STATUS_MAP: Record<number, { color: string; labelKey: string }> = {
  0: { color: 'orange', labelKey: 'admin.review.status.pending' },
  1: { color: 'green', labelKey: 'admin.review.status.approved' },
  2: { color: 'red', labelKey: 'admin.review.status.rejected' },
};

export default function AdminThemeReview() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [list, setList] = useState<ThemeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [actionTarget, setActionTarget] = useState<ThemeItem | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await adminApi.pendingThemes({ page: 1, size: 50 });
      if (resp.code === 200 && resp.data) setList(resp.data.records);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, []);

  if (!profile || profile.roleCode !== 'ADMIN') {
    return <div className="page-container"><Card style={{ textAlign: 'center', padding: 40 }}><Text type="danger">{t('admin.noPermission')}</Text></Card></div>;
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!actionTarget) return;
    try {
      await adminApi.reviewTheme({ themeId: actionTarget.id, action, comment: comment || undefined });
      message.success(action === 'approve' ? t('admin.review.approved') : t('admin.review.rejected'));
      setActionTarget(null);
      setComment('');
      fetchList();
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: t('admin.review.columns.id'), dataIndex: 'id', width: 60 },
    { title: t('admin.review.columns.name'), dataIndex: 'name' },
    { title: t('admin.review.columns.author'), dataIndex: 'author', width: 120 },
    { title: t('admin.review.columns.category'), dataIndex: 'category', width: 80 },
    { title: t('admin.review.columns.submitTime'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    { title: t('admin.review.columns.status'), dataIndex: 'status', width: 80, render: (s: number) => <Tag color={STATUS_MAP[s]?.color}>{t(STATUS_MAP[s]?.labelKey ?? '')}</Tag> },
    {
      title: t('admin.review.columns.action'), width: 160,
      render: (_: unknown, r: ThemeItem) => r.status === 0 ? (
        <Button size="small" onClick={() => setActionTarget(r)}>{t('admin.review.action')}</Button>
      ) : '-',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header"><h1 className="page-title">{t('admin.review.title')}</h1></div>
      <Card>
        <Table dataSource={list} columns={columns} rowKey="id" loading={loading} size="small"
          pagination={{ pageSize: 15 }} />
      </Card>
      <Modal
        title={t('admin.review.modalTitle')}
        open={!!actionTarget}
        onCancel={() => setActionTarget(null)}
        footer={[
          <Button key="reject" danger icon={<CloseOutlined />} onClick={() => handleReview('reject')}>{t('admin.review.reject')}</Button>,
          <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => handleReview('approve')}>{t('admin.review.approve')}</Button>,
        ]}
      >
        {actionTarget && (
          <div>
            <p><b>{t('admin.review.nameLabel')}</b>{actionTarget.name} v{actionTarget.version}</p>
            <p><b>{t('admin.review.authorLabel')}</b>{actionTarget.author}</p>
            <p><b>{t('admin.review.descLabel')}</b>{actionTarget.description || '-'}</p>
            <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('admin.review.commentPlaceholder')} />
          </div>
        )}
      </Modal>
    </div>
  );
}