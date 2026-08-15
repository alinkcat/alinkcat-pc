import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/setup';
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
  { label: i18n.t('upload.category_desktop'), value: 'desktop' },
  { label: i18n.t('upload.category_streaming'), value: 'streaming' },
  { label: i18n.t('upload.category_office'), value: 'office' },
  { label: i18n.t('upload.category_gaming'), value: 'gaming' },
  { label: i18n.t('upload.category_other'), value: 'other' },
];

const STATUS_MAP: Record<number, { color: string; label: string }> = {
  0: { color: 'orange', label: i18n.t('upload.statusPending') },
  1: { color: 'green', label: i18n.t('upload.statusApproved') },
  2: { color: 'red', label: i18n.t('upload.statusRejected') },
  3: { color: 'default', label: i18n.t('upload.statusRemoved') },
};

export default function UploadCenter() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      // Poll review status in real time
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
          msg.success(t('upload.uploadSuccess'));
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
      title: t('upload.deleteConfirmTitle'),
      content: t('upload.deleteConfirmContent', { name: item.name }),
      okText: t('upload.deleteConfirm'),
      okType: 'danger',
      cancelText: t('upload.cancel'),
      onOk: async () => {
        try {
          await themeApi.delete(item.id);
          msg.success(t('upload.deleted'));
          fetchMyThemes();
        } catch (e) { msg.error(String(e)); }
      },
    });
  };

  const columns = [
    { title: t('upload.id'), dataIndex: 'id', width: 80 },
    { title: t('upload.themeName'), dataIndex: 'name' },
    { title: t('upload.version'), dataIndex: 'version', width: 80 },
    {
      title: t('upload.reviewStatus'), dataIndex: 'status', width: 100,
      render: (s: number) => {
        const info = STATUS_MAP[s] || { color: 'default', label: String(s) };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    { title: t('upload.reviewComment'), dataIndex: 'reviewComment', ellipsis: true, render: (v: string) => v || '-' },
    { title: t('upload.submitTime'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('upload.actions'), width: 140,
      render: (_: unknown, r: ThemeItem) => (
        <Space>
          <Button type="link" size="small" onClick={() => setDetail(r)}>{t('upload.detail')}</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>{t('upload.delete')}</Button>
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
          { title: t('upload.statusSubmitted') },
          { title: status === 2 ? t('upload.statusRejected') : t('upload.statusReviewing'), status: status === 2 ? 'error' : status === 0 ? 'process' : 'wait' },
          { title: t('upload.statusApproved'), status: status === 1 ? 'finish' : 'wait' },
        ]}
      />
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/themes')}>{t('upload.back')}</Button>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{t('upload.title')}</h1>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={t('upload.uploadTheme')}>
            {!isLoggedIn ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ marginBottom: 16 }}>{t('upload.loginRequired')}</div>
                <Button type="primary" onClick={() => navigate('/auth')}>{t('upload.login')}</Button>
              </div>
            ) : (
              <Form form={form} layout="vertical">
                <Form.Item name="themeId" label={t('upload.selectLocalTheme')} rules={[{ required: true, message: t('upload.selectLocalThemeRequired') }]}>
                  <Select
                    placeholder={t('upload.selectLocalPlaceholder')}
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
                <Form.Item name="name" label={t('upload.themeName')} rules={[{ required: true, message: t('upload.themeNameRequired') }]}>
                  <Input />
                </Form.Item>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Form.Item name="version" label={t('upload.version')} style={{ flex: 1 }} rules={[{ required: true, message: t('upload.versionRequired') }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="author" label={t('upload.author')} style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                </div>
                <Form.Item name="category" label={t('upload.category')} rules={[{ required: true, message: t('upload.categoryRequired') }]}>
                  <Select options={CATEGORY_OPTIONS} placeholder={t('upload.categoryPlaceholder')} />
                </Form.Item>
                <Form.Item name="tags" label={t('upload.tags')}>
                  <Input placeholder={t('upload.tagsPlaceholder')} />
                </Form.Item>
                <Form.Item name="description" label={t('upload.description')}>
                  <Input.TextArea rows={3} placeholder={t('upload.descriptionPlaceholder')} />
                </Form.Item>
                <Form.Item label={t('upload.cover')}>
                  <Upload
                    listType="picture-card"
                    accept="image/*"
                    maxCount={1}
                    beforeUpload={(file) => { setCoverFile(file); return false; }}
                    onRemove={() => { setCoverFile(null); return true; }}
                    fileList={coverFile ? [{ uid: '-1', name: coverFile.name, status: 'done' }] : []}
                  >
                    {coverFile ? null : <div><InboxOutlined /><div style={{ marginTop: 4 }}>{t('upload.uploadCover')}</div></div>}
                  </Upload>
                </Form.Item>
                <Button type="primary" icon={<UploadOutlined />} loading={submitting} onClick={handleSubmit}>
                  {t('upload.submitReview')}
                </Button>
              </Form>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title={t('upload.reviewStatus')}>
            {records.length === 0 ? (
              <Empty description={t('upload.noRecords')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {records.slice(0, 3).map((r) => (
                  <div key={r.id}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>{r.name} v{r.version}</Text>
                    {statusStep(r.status)}
                    {r.status === 2 && r.reviewComment && (
                      <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                        {t('upload.rejectReason', { reason: r.reviewComment })}
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
        title={t('upload.uploadRecords')}
        style={{ marginTop: 16 }}
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchMyThemes}>{t('upload.refresh')}</Button>}
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (tTotal: number) => t('upload.totalCount', { total: tTotal }) }}
          locale={{ emptyText: t('upload.emptyTable') }}
        />
      </Card>

      <Modal title={t('upload.recordDetail')} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={520}>
        {detail && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Text><b>{t('upload.id')}：</b>{detail.id}</Text>
            <Text><b>{t('upload.themeInfo')}：</b>{detail.name} v{detail.version}</Text>
            <Text><b>{t('upload.author')}：</b>{detail.author || '-'}</Text>
            <Text><b>{t('upload.submitTime')}：</b>{new Date(detail.createdAt).toLocaleString()}</Text>
            <Text><b>{t('upload.reviewStatus')}：</b><Tag color={STATUS_MAP[detail.status]?.color}>{STATUS_MAP[detail.status]?.label}</Tag></Text>
            {detail.reviewComment && <Text><b>{t('upload.reviewComment')}：</b>{detail.reviewComment}</Text>}
            <Text><b>{t('upload.downloads')}：</b>{detail.downloadCount}</Text>
            <Text><b>{t('upload.rating')}：</b>{detail.rating > 0 ? `${detail.rating} ${t('upload.votes', { count: detail.ratingCount })}` : t('upload.noRating')}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}
