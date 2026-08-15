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
  0: { text: '待处理', color: 'warning' },
  1: { text: '处理中', color: 'processing' },
  2: { text: '已回复', color: 'success' },
  3: { text: '已关闭', color: 'default' },
};
const PRIORITY_MAP: Record<number, { text: string; color: string }> = {
  1: { text: '低', color: 'default' }, 2: { text: '中', color: 'warning' },
  3: { text: '高', color: 'error' }, 4: { text: '紧急', color: 'error' },
};

export default function Tickets() {
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
          <h1 className="page-title">工单中心</h1>
          <p className="page-subtitle">登录后查看和提交工单</p>
        </div>
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <Button type="primary" onClick={() => navigate('/auth')}>去登录</Button>
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
      message.success('工单已提交');
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
      message.success('回复成功');
      setReplyText('');
      fetchReplies(detail.id).catch(() => {});
      fetchMy().catch(() => {});
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '类型', dataIndex: 'category', width: 100,
      render: (v: string) => <Tag>{v || '其他'}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', width: 80,
      render: (v: number) => { const info = PRIORITY_MAP[v] || PRIORITY_MAP[2]; return <Tag color={info.color}>{info.text}</Tag>; },
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: number) => { const info = STATUS_MAP[v] || STATUS_MAP[0]; return <Tag color={info.color}>{info.text}</Tag>; },
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', width: 80,
      render: (_: unknown, record: TicketItem) => <Button size="small" icon={<MessageOutlined />} onClick={() => openDetail(record)}>详情</Button>,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">工单中心</h1>
        <p className="page-subtitle">提交问题与反馈</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>提交工单</Button>
      </div>

      <Card>
        <Table
          dataSource={myTickets}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* Create */}
      <Modal title="提交工单" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} okText="提交">
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="简要描述问题" />
          </Form.Item>
          <Form.Item name="content" label="详细描述" rules={[{ required: true, message: '请输入描述' }]}>
            <Input.TextArea rows={4} placeholder="详细描述你遇到的问题或需求" />
          </Form.Item>
          <Form.Item name="category" label="类型">
            <Select options={[
              { label: '功能建议', value: 'feature' },
              { label: 'Bug 反馈', value: 'bug' },
              { label: '问题咨询', value: 'question' },
              { label: '其他', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select options={[
              { label: '低', value: 1 }, { label: '中', value: 2 },
              { label: '高', value: 3 }, { label: '紧急', value: 4 },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail */}
      <Modal
        title={detail?.title || '工单详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={detail && detail.status < 3 ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Input.TextArea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              placeholder="输入回复内容..."
              style={{ flex: 1 }}
            />
            <Button type="primary" onClick={handleReply}>回复</Button>
          </div>
        ) : null}
        width={640}
      >
        {detail && (
          <>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="状态"><Tag color={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.text}</Tag></Descriptions.Item>
              <Descriptions.Item label="优先级"><Tag color={PRIORITY_MAP[detail.priority]?.color}>{PRIORITY_MAP[detail.priority]?.text}</Tag></Descriptions.Item>
              <Descriptions.Item label="类型">{detail.category || '其他'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <Card size="small" style={{ marginTop: 8, background: '#fafafa' }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</div>
            </Card>
            <div style={{ marginTop: 16, fontWeight: 600 }}>回复记录 ({replies.length})</div>
            {replies.length === 0 ? <Empty description="暂无回复" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
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
                      {r.isStaff ? '官方回复' : '用户回复'} · {new Date(r.createdAt).toLocaleString()}
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
