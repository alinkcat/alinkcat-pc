import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Form, Input, Select, Steps, Table, Tag, Upload, Typography, Modal, Space, Row, Col, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, UploadOutlined, InboxOutlined, ReloadOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { tauriInvoke } from '../utils/tauri';
import { useAuthStore } from '../store/authStore';
import { themeApi } from '../api/themeApi';
import { useMessage } from '../hooks/useMessage';
import { getThemeSource } from '../utils/themeSource';
import type { ThemeSummary } from '../types/theme';
import type { ThemeItem } from '../api/types';

const { Text } = Typography;

const CATEGORY_OPTIONS = [
  { label: '桌面', value: 'desktop' },
  { label: '直播', value: 'streaming' },
  { label: '办公', value: 'office' },
  { label: '游戏', value: 'gaming' },
  { label: '其他', value: 'other' },
];

const STATUS_MAP: Record<number, { color: string; label: string }> = {
  0: { color: 'orange', label: '待审核' },
  1: { color: 'green', label: '已通过' },
  2: { color: 'red', label: '已驳回' },
  3: { color: 'default', label: '已下架' },
};

export default function UploadCenter() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { message: msg } = useMessage();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [records, setRecords] = useState<ThemeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<ThemeItem | null>(null);

  const localThemes = useMemo(() => themes.filter((t) => getThemeSource(t) === 'local'), [themes]);

  const fetchMyThemes = async () => {
    setLoading(true);
    try {
      const resp = await themeApi.my({ page: 1, size: 50 });
      if (resp.code === 200 && resp.data) setRecords(resp.data.records);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    tauriInvoke<ThemeSummary[]>('scan_themes').then(setThemes).catch(() => {});
    if (isLoggedIn) {
      fetchMyThemes();
      // 实时轮询审核状态
      const timer = setInterval(fetchMyThemes, 10_000);
      return () => clearInterval(timer);
    }
  }, [isLoggedIn]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      try {
        const packed = await tauriInvoke<{ base64: string; size: number; hash: string }>('pack_theme_data', { themeId: values.themeId });
        const themeBlob = new Blob([Uint8Array.from(atob(packed.base64), c => c.charCodeAt(0))], { type: 'application/zip' });
        const themeFile = new File([themeBlob], `${values.themeId}.alc`, { type: 'application/zip' });

        const fd = new FormData();
        fd.append('name', values.name);
        fd.append('version', values.version);
        fd.append('author', values.author || '');
        fd.append('description', values.description || '');
        fd.append('category', values.category || '');
        fd.append('tags', values.tags || '');
        fd.append('file', themeFile);
        if (coverFile) fd.append('cover', coverFile);

        const resp = await themeApi.upload(fd);
        if (resp.code === 200) {
          msg.success('上传成功，等待管理员审核');
        } else {
          msg.warning(resp.message);
        }

        form.resetFields();
        setCoverFile(null);
        await fetchMyThemes();
      } catch (e) {
        msg.error(String(e));
      } finally {
        setSubmitting(false);
      }
    } catch { /* validation */ }
  };

  const handleDelete = (item: ThemeItem) => {
    Modal.confirm({
      title: '删除主题包',
      content: `确定要删除「${item.name}」吗？删除后无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await themeApi.delete(item.id);
          msg.success('已删除');
          fetchMyThemes();
        } catch (e) { msg.error(String(e)); }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '主题包名称', dataIndex: 'name' },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (s: number) => {
        const info = STATUS_MAP[s] || { color: 'default', label: String(s) };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    { title: '审核意见', dataIndex: 'reviewComment', ellipsis: true, render: (v: string) => v || '-' },
    { title: '提交时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '操作', width: 140,
      render: (_: unknown, r: ThemeItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => setDetail(r)}>详情</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>删除</Button>
        </Space>
      ),
    },
  ];

  const statusStep = (status: number) => {
    const idx = status === 0 ? 0 : status === 1 ? 2 : 1;
    return (
      <Steps
        size="small"
        current={idx}
        items={[
          { title: '已提交' },
          { title: status === 2 ? '已驳回' : '审核中', status: status === 2 ? 'error' : status === 0 ? 'process' : 'wait' },
          { title: '已通过', status: status === 1 ? 'finish' : 'wait' },
        ]}
      />
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/themes')}>返回</Button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>主题上传中心</h1>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="上传主题包">
            {!isLoggedIn ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ marginBottom: 16 }}>请先登录后再上传主题包</div>
                <Button type="primary" onClick={() => navigate('/auth')}>去登录</Button>
              </div>
            ) : (
              <Form form={form} layout="vertical">
                <Form.Item name="themeId" label="选择本地主题包" rules={[{ required: true, message: '请选择主题包' }]}>
                  <Select
                    placeholder="仅显示本地创建的主题包"
                    options={localThemes.map((t) => ({
                      value: t.id,
                      label: `${t.name} (v${t.version} · ${t.author})`,
                    }))}
                    showSearch
                    optionFilterProp="label"
                    onChange={(id) => {
                      const t = localThemes.find(x => x.id === id);
                      if (t) form.setFieldsValue({ name: t.name, version: t.version, author: t.author });
                    }}
                  />
                </Form.Item>
                <Form.Item name="name" label="主题包名称" rules={[{ required: true, message: '请输入名称' }]}>
                  <Input />
                </Form.Item>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Form.Item name="version" label="版本号" style={{ flex: 1 }} rules={[{ required: true, message: '请输入版本号' }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="author" label="作者" style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                </div>
                <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                  <Select options={CATEGORY_OPTIONS} placeholder="选择分类" />
                </Form.Item>
                <Form.Item name="tags" label="标签">
                  <Input placeholder="多个标签用逗号分隔，如：极简,效率" />
                </Form.Item>
                <Form.Item name="description" label="详细描述">
                  <Input.TextArea rows={3} placeholder="介绍你的主题包..." />
                </Form.Item>
                <Form.Item label="封面图（可选）">
                  <Upload
                    listType="picture-card"
                    accept="image/*"
                    maxCount={1}
                    beforeUpload={(file) => { setCoverFile(file); return false; }}
                    onRemove={() => { setCoverFile(null); return true; }}
                    fileList={coverFile ? [{ uid: '-1', name: coverFile.name, status: 'done' }] : []}
                  >
                    {coverFile ? null : <div><InboxOutlined /><div style={{ marginTop: 4 }}>上传封面</div></div>}
                  </Upload>
                </Form.Item>
                <Button type="primary" icon={<UploadOutlined />} loading={submitting} onClick={handleSubmit}>
                  上传并提交审核
                </Button>
              </Form>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="审核状态">
            {records.length === 0 ? (
              <Empty description="暂无上传记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {records.slice(0, 3).map((r) => (
                  <div key={r.id}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>{r.name} v{r.version}</Text>
                    {statusStep(r.status)}
                    {r.status === 2 && r.reviewComment && (
                      <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                        驳回原因：{r.reviewComment}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="上传记录"
        style={{ marginTop: 16 }}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchMyThemes}>刷新</Button>}
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无上传记录' }}
        />
      </Card>

      <Modal title="上传记录详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={520}>
        {detail && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Text><b>ID：</b>{detail.id}</Text>
            <Text><b>主题包：</b>{detail.name} v{detail.version}</Text>
            <Text><b>作者：</b>{detail.author || '-'}</Text>
            <Text><b>提交时间：</b>{new Date(detail.createdAt).toLocaleString()}</Text>
            <Text><b>状态：</b><Tag color={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.label}</Tag></Text>
            {detail.reviewComment && <Text><b>审核意见：</b>{detail.reviewComment}</Text>}
            <Text><b>下载量：</b>{detail.downloadCount}</Text>
            <Text><b>评分：</b>{detail.rating > 0 ? `${detail.rating} (${detail.ratingCount} 票)` : '暂无评分'}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
