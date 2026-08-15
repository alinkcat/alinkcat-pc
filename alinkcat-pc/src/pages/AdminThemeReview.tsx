import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Typography, Modal, Input, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { adminApi } from '../api/adminApi';
import { useAuthStore } from '../store/authStore';
import type { ThemeItem } from '../api/types';

const { Text } = Typography;

const STATUS_MAP: Record<number, { color: string; label: string }> = {
  0: { color: 'orange', label: '待审核' },
  1: { color: 'green', label: '已通过' },
  2: { color: 'red', label: '已驳回' },
};

export default function AdminThemeReview() {
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
    return <div className="page-container"><Card style={{ textAlign: 'center', padding: 40 }}><Text type="danger">无管理员权限</Text></Card></div>;
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    if (!actionTarget) return;
    try {
      await adminApi.reviewTheme({ themeId: actionTarget.id, action, comment: comment || undefined });
      message.success(action === 'approve' ? '已通过' : '已驳回');
      setActionTarget(null);
      setComment('');
      fetchList();
    } catch (e) { message.error(String(e)); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '作者', dataIndex: 'author', width: 120 },
    { title: '分类', dataIndex: 'category', width: 80 },
    { title: '提交时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: number) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label}</Tag> },
    {
      title: '操作', width: 160,
      render: (_: unknown, r: ThemeItem) => r.status === 0 ? (
        <Button size="small" onClick={() => setActionTarget(r)}>审核</Button>
      ) : '-',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header"><h1 className="page-title">主题审核</h1></div>
      <Card>
        <Table dataSource={list} columns={columns} rowKey="id" loading={loading} size="small"
          pagination={{ pageSize: 15 }} />
      </Card>
      <Modal
        title="审核主题包"
        open={!!actionTarget}
        onCancel={() => setActionTarget(null)}
        footer={[
          <Button key="reject" danger icon={<CloseOutlined />} onClick={() => handleReview('reject')}>驳回</Button>,
          <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => handleReview('approve')}>通过</Button>,
        ]}
      >
        {actionTarget && (
          <div>
            <p><b>名称：</b>{actionTarget.name} v{actionTarget.version}</p>
            <p><b>作者：</b>{actionTarget.author}</p>
            <p><b>描述：</b>{actionTarget.description || '-'}</p>
            <Input.TextArea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="审核意见（选填）" />
          </div>
        )}
      </Modal>
    </div>
  );
}