import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, Modal, Input, message } from 'antd';
import { adminApi } from '../api/adminApi';
import { useAuthStore } from '../store/authStore';
import type { TicketItem } from '../api/types';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const STATUS_MAP: Record<number, { color: string; labelKey: string }> = {
  0: { color: 'warning', labelKey: 'admin.tickets.status.pending' },
  1: { color: 'processing', labelKey: 'admin.tickets.status.processing' },
  2: { color: 'success', labelKey: 'admin.tickets.status.replied' },
  3: { color: 'default', labelKey: 'admin.tickets.status.closed' },
};

export default function AdminTickets() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [list, setList] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<TicketItem | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await adminApi.allTickets({ page: 1, size: 50 });
      if (resp.code === 200 && resp.data) setList(resp.data.records);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, []);

  if (!profile || profile.roleCode !== 'ADMIN') {
    return <div className="page-container"><Card style={{ textAlign: 'center', padding: 40 }}><Text type="danger">{t('admin.noPermission')}</Text></Card></div>;
  }

  const handleReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    try {
      await adminApi.replyTicket(replyTarget.id, replyText.trim());
      message.success(t('admin.tickets.replySuccess'));
      setReplyOpen(false);
      setReplyTarget(null);
      setReplyText('');
      fetchList();
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: t('admin.tickets.columns.id'), dataIndex: 'id', width: 60 },
    { title: t('admin.tickets.columns.title'), dataIndex: 'title', ellipsis: true },
    { title: t('admin.tickets.columns.user'), dataIndex: 'username', width: 100 },
    { title: t('admin.tickets.columns.category'), dataIndex: 'category', width: 80, render: (v: string) => <Tag>{v || t('admin.tickets.other')}</Tag> },
    { title: t('admin.tickets.columns.status'), dataIndex: 'status', width: 80, render: (s: number) => <Tag color={STATUS_MAP[s]?.color}>{t(STATUS_MAP[s]?.labelKey ?? '')}</Tag> },
    { title: t('admin.tickets.columns.createdAt'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('admin.tickets.columns.action'), width: 120,
      render: (_: unknown, r: TicketItem) => r.status < 3 && (
        <Button size="small" onClick={() => { setReplyTarget(r); setReplyOpen(true); }}>{t('admin.tickets.reply')}</Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header"><h1 className="page-title">{t('admin.tickets.title')}</h1></div>
      <Card>
        <Table dataSource={list} columns={columns} rowKey="id" loading={loading} size="small"
          pagination={{ pageSize: 15 }} />
      </Card>
      <Modal
        title={t('admin.tickets.modalTitle')}
        open={replyOpen}
        onCancel={() => setReplyOpen(false)}
        onOk={handleReply}
        okText={t('admin.tickets.reply')}
      >
        {replyTarget && (
          <div>
            <p><b>{t('admin.tickets.titleLabel')}</b>{replyTarget.title}</p>
            <p><b>{t('admin.tickets.contentLabel')}</b>{replyTarget.content}</p>
            <Input.TextArea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t('admin.tickets.replyPlaceholder')} />
          </div>
        )}
      </Modal>
    </div>
  );
}