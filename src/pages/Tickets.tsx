import { useTranslation } from 'react-i18next';
import i18n from '../i18n/setup';
import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Modal, Form, Input, Select, message, Empty, Descriptions,
} from 'antd';
import { PlusOutlined, MessageOutlined } from '@ant-design/icons';
import { useTicketStore } from '../store/ticketStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import type { TicketItem } from '../api/types';

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: i18n.t('tickets.status_pending'), color: 'warning' },
  1: { text: i18n.t('tickets.status_processing'), color: 'processing' },
  2: { text: i18n.t('tickets.status_replied'), color: 'success' },
  3: { text: i18n.t('tickets.status_closed'), color: 'default' },
};
const PRIORITY_MAP: Record<number, { text: string; color: string }> = {
  1: { text: i18n.t('tickets.priority_low'), color: 'default' }, 2: { text: i18n.t('tickets.priority_medium'), color: 'warning' },
  3: { text: i18n.t('tickets.priority_high'), color: 'error' }, 4: { text: i18n.t('tickets.priority_urgent'), color: 'error' },
};

export default function Tickets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { myTickets, detail, replies, loading, fetchMy, fetchDetail, fetchReplies, create, reply } = useTicketStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [createForm] = Form.useForm();

  useEffect(() => {
    if (isLoggedIn) fetchMy().catch(() => {});
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">{t('tickets.title')}</h1>
          <p className="page-subtitle">{t('tickets.subtitle')}</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Button type="primary" onClick={() => navigate('/auth')}>{t('tickets.loginRequired')}</Button>
        </Card>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await create({
        title: values.title,
        content: values.content,
        category: values.category || 'other',
        priority: values.priority || 2,
      });
      message.success(t('tickets.submitted'));
      setCreateOpen(false);
      createForm.resetFields();
      fetchMy().catch(() => {});
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) message.error(String((e as Error).message));
    }
  };

  const openDetail = async (ticket: TicketItem) => {
    await fetchDetail(ticket.id);
    await fetchReplies(ticket.id);
    setDetailOpen(true);
  };

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    try {
      await reply(detail.id, replyText.trim());
      message.success(t('tickets.replySuccess'));
      setReplyText('');
      fetchReplies(detail.id).catch(() => {});
      fetchMy().catch(() => {});
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: t('tickets.title'), dataIndex: 'title', ellipsis: true },
    {
      title: t('tickets.category'), dataIndex: 'category', width: 100,
      render: (v: string) => <Tag>{v || t('tickets.category_other')}</Tag>,
    },
    {
      title: t('tickets.priority'), dataIndex: 'priority', width: 80,
      render: (v: number) => { const info = PRIORITY_MAP[v] || PRIORITY_MAP[2]; return <Tag color={info.color}>{info.text}</Tag>; },
    },
    {
      title: t('tickets.status'), dataIndex: 'status', width: 100,
      render: (v: number) => { const info = STATUS_MAP[v] || STATUS_MAP[0]; return <Tag color={info.color}>{info.text}</Tag>; },
    },
    { title: t('tickets.createdAt'), dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('tickets.actions'), width: 80,
      render: (_: unknown, record: TicketItem) => <Button size="small" icon={<MessageOutlined />} onClick={() => openDetail(record)}>{t('tickets.detail')}</Button>,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('tickets.title')}</h1>
        <p className="page-subtitle">{t('tickets.subtitleLoggedIn')}</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('tickets.submitTicket')}</Button>
      </div>

      <Card>
        <Table
          dataSource={myTickets}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showTotal: (total) => t('tickets.totalCount', { total }) }}
        />
      </Card>

      {/* Create */}
      <Modal title={t('tickets.createTicket')} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText={t('tickets.submit')}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label={t('tickets.title')} rules={[{ required: true, message: t('tickets.titleRequired') }]}>
            <Input placeholder={t('tickets.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="content" label={t('tickets.content')} rules={[{ required: true, message: t('tickets.contentRequired') }]}>
            <Input.TextArea rows={4} placeholder={t('tickets.contentPlaceholder')} />
          </Form.Item>
          <Form.Item name="category" label={t('tickets.category')}>
            <Select options={[
              { label: t('tickets.category_feature'), value: 'feature' },
              { label: t('tickets.category_bug'), value: 'bug' },
              { label: t('tickets.category_question'), value: 'question' },
              { label: t('tickets.category_other'), value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="priority" label={t('tickets.priority')}>
            <Select options={[
              { label: t('tickets.priority_low'), value: 1 }, { label: t('tickets.priority_medium'), value: 2 },
              { label: t('tickets.priority_high'), value: 3 }, { label: t('tickets.priority_urgent'), value: 4 },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail */}
      <Modal
        title={detail?.title || t('tickets.ticketDetail')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={detail && detail.status < 3 ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Input.TextArea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              placeholder={t('tickets.replyPlaceholder')}
              style={{ flex: 1 }}
            />
            <Button type="primary" onClick={handleReply}>{t('tickets.reply')}</Button>
          </div>
        ) : null}
        width={640}
      >
        {detail && (
          <>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('tickets.ticketStatus')}><Tag color={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.text}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('tickets.ticketPriority')}><Tag color={PRIORITY_MAP[detail.priority]?.color}>{PRIORITY_MAP[detail.priority]?.text}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('tickets.ticketCategory')}>{detail.category || t('tickets.category_other')}</Descriptions.Item>
              <Descriptions.Item label={t('tickets.ticketCreatedAt')}>{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <Card size="small" style={{ marginTop: 8, background: '#fafafa' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</div>
            </Card>
            <div style={{ marginTop: 16, fontWeight: 600 }}>{t('tickets.replyRecords', { count: replies.length })}</div>
            {replies.length === 0 ? <Empty description={t('tickets.noReplies')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {replies.map((r) => (
                  <Card
                    key={r.id} size="small" style={{
                      marginTop: 8,
                      background: r.isStaff ? '#e6f7ff' : '#fff',
                      border: r.isStaff ? '1px solid #91d5ff' : '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                      {r.isStaff ? t('tickets.staffReply') : t('tickets.userReply')} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.content}</div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
