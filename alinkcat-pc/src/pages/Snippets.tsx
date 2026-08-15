import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Tag,
  Flex,
  Space,
  Typography,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  SearchOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { Snippet } from '../types/theme';

const { Text, Paragraph } = Typography;
const STORAGE_KEY = 'ilinkcat_snippets';

function loadSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnippets(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

export default function Snippets() {
  const { t } = useTranslation();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [filterTheme, setFilterTheme] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [form] = Form.useForm();
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSnippets(loadSnippets());
  }, []);

  const filtered = snippets.filter((s) => {
    if (filterTheme && s.theme_id !== filterTheme) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        s.label.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const themeIds = [...new Set(snippets.map((s) => s.theme_id).filter(Boolean))];

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (snippet: Snippet) => {
    setEditing(snippet);
    form.setFieldsValue(snippet);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const now = new Date().toISOString();
      let updated: Snippet[];
      if (editing) {
        updated = snippets.map((s) =>
          s.id === editing.id ? { ...s, ...values } : s
        );
      } else {
        const newSnippet: Snippet = {
          id: Date.now().toString(),
          ...values,
          created_at: now,
        };
        updated = [...snippets, newSnippet];
      }
      setSnippets(updated);
      saveSnippets(updated);
      setModalOpen(false);
      message.success(editing ? t('snippets.updated') : t('snippets.added'));
    } catch {
      // validation failed
    }
  };

  const handleDelete = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    saveSnippets(updated);
    message.success(t('snippets.deleted'));
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(snippets, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('snippets.exportSuccess'));
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(imported)) throw new Error('Invalid');
        const valid = imported.filter(
          (s: Partial<Snippet>) => s.id && s.label && s.content
        );
        const updated = [...snippets, ...valid];
        setSnippets(updated);
        saveSnippets(updated);
        message.success(t('snippets.importSuccess', { count: valid.length }));
      } catch {
        message.error(t('snippets.importFailed'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <h1 className="page-title">{t('snippets.title')}</h1>
            <p className="page-subtitle">{t('snippets.subtitle')}</p>
          </div>
          <Space>
            <Button icon={<ImportOutlined />} onClick={() => importRef.current?.click()}>
              {t('snippets.import')}
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport} disabled={snippets.length === 0}>
              {t('snippets.export')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              {t('snippets.add')}
            </Button>
          </Space>
        </Flex>
      </div>

      <div className="snippet-toolbar">
        <Input
          placeholder={t('snippets.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <Select
          placeholder={t('snippets.filterTheme')}
          value={filterTheme || undefined}
          onChange={(v) => setFilterTheme(v || '')}
          allowClear
          options={themeIds.map((id) => ({ label: id, value: id }))}
        />
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
          {t('snippets.totalCount', { count: filtered.length })}
        </Text>
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {filtered.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={snippets.length === 0 ? t('snippets.empty') : t('snippets.noMatch')}
          style={{ padding: '80px 0' }}
        >
          {snippets.length === 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              {t('snippets.add')}
            </Button>
          )}
        </Empty>
      ) : (
        <Flex vertical gap={12}>
          {filtered.map((snippet) => (
            <Card
              key={snippet.id}
              className="snippet-card"
              hoverable
              styles={{ body: { padding: 16 } }}
            >
              <Flex justify="space-between" align="flex-start" gap={16}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="center" gap={8} style={{ marginBottom: 4 }}>
                    <FileTextOutlined style={{ color: '#4F6EF7', flexShrink: 0 }} />
                    <span className="snippet-card-label">{snippet.label}</span>
                    {snippet.theme_id && (
                      <Tag color="blue" style={{ marginLeft: 0 }}>
                        {snippet.theme_id}
                      </Tag>
                    )}
                  </Flex>
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    className="snippet-card-content"
                  >
                    {snippet.content}
                  </Paragraph>
                </div>
                <Space size={0} style={{ flexShrink: 0 }}>
                  <Tooltip title={t('snippets.edit')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(snippet)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title={t('snippets.deleteConfirm')}
                    onConfirm={() => handleDelete(snippet.id)}
                    okText={t('snippets.deleteOk')}
                    cancelText={t('snippets.deleteCancel')}
                  >
                    <Tooltip title={t('snippets.delete')}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      <Modal
        title={editing ? t('snippets.editSnippet') : t('snippets.addSnippet')}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={t('snippets.save')}
        cancelText={t('snippets.cancel')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="label"
            label={t('snippets.label')}
            rules={[{ required: true, message: t('snippets.labelRequired') }]}
          >
            <Input placeholder={t('snippets.labelPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="content"
            label={t('snippets.content')}
            rules={[{ required: true, message: t('snippets.contentRequired') }]}
          >
            <Input.TextArea rows={4} placeholder={t('snippets.contentPlaceholder')} />
          </Form.Item>
          <Form.Item name="theme_id" label={t('snippets.themeId')}>
            <Input placeholder={t('snippets.themeIdPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
