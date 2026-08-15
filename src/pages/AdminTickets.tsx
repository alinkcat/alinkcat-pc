import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, Modal, Input, message } from 'antd';
import { adminApi } from '../api/adminApi';
import { useAuthStore } from '../store/authStore';
import type { TicketItem } from '../api/types';

const { Text } = Typography;

const STATUS_MAP: Record<number, { color: string; label: string }> = {
  0: { color: 'warning', label: '待处理' },
  1: { color: 'processing', label: '处理中' },
  2: { color: 'success', label: '已回复' },
  3: { color: 'default', label: '已关闭' },
};

export default function AdminTickets() {
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
    return <div className="page-container"><Card style={{ textAlign: 'center', padding: 40 }}><Text type="danger">无管理员权限</Text></Card></div>;
  }

  const handleReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    try {
      await adminApi.replyTicket(replyTarget.id, replyText.trim());
      message.success('回复成功');
      setReplyOpen(false);
      setReplyTarget(null);
      setReplyText('');
      fetchList();
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '用户', dataIndex: 'username', width: 100 },
    { title: '类型', dataIndex: 'category', width: 80, render: (v: string) => <Tag>{v || '其他'}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: number) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', width: 120,
      render: (_: unknown, r: TicketItem) => r.status < 3 && (
        <Button size="small" onClick={() => { setReplyTarget(r); setReplyOpen(true); }}>回复</Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header"><h1 className="page-title">工单管理</h1></div>
      <Card>
        <Table dataSource={list} columns={columns} rowKey="id" loading={loading} size="small"
          pagination={{ pageSize: 15 }} />
      </Card>
      <Modal
        title="回复工单"
        open={replyOpen}
        onCancel={() => setReplyOpen(false)}
        onOk={handleReply}
        okText="回复"
      >
        {replyTarget && (
          <div>
            <p><b>标题：</b>{replyTarget.title}</p>
            <p><b>内容：</b>{replyTarget.content}</p>
            <Input.TextArea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="输入回复内容..." />
          </div>
        )}
      </Modal>
    </div>
  );
}