import { useState, useEffect, useRef } from 'react';
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
      message.success(editing ? '已更新' : '已添加');
    } catch {
      // validation failed
    }
  };

  const handleDelete = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    saveSnippets(updated);
    message.success('已删除');
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
    message.success('导出成功');
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
        message.success(`导入 ${valid.length} 条片段`);
      } catch {
        message.error('导入失败：文件格式无效');
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
            <h1 className="page-title">快捷输入</h1>
            <p className="page-subtitle">管理快捷输入片段和模板</p>
          </div>
          <Space>
            <Button icon={<ImportOutlined />} onClick={() => importRef.current?.click()}>
              导入
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport} disabled={snippets.length === 0}>
              导出
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增片段
            </Button>
          </Space>
        </Flex>
      </div>

      <div className="snippet-toolbar">
        <Input
          placeholder="搜索标签或内容..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <Select
          placeholder="按主题筛选"
          value={filterTheme || undefined}
          onChange={(v) => setFilterTheme(v || '')}
          allowClear
          options={themeIds.map((id) => ({ label: id, value: id }))}
        />
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
          共 {filtered.length} 条
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
          description={snippets.length === 0 ? '暂无快捷输入片段' : '无匹配结果'}
          style={{ padding: '80px 0' }}
        >
          {snippets.length === 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增片段
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
                  <Tooltip title="编辑">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(snippet)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="确定删除该片段？"
                    onConfirm={() => handleDelete(snippet.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Tooltip title="删除">
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
        title={editing ? '编辑片段' : '新增片段'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="label"
            label="标签"
            rules={[{ required: true, message: '请输入标签' }]}
          >
            <Input placeholder="例如：邮箱签名" />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={4} placeholder="要粘贴的文本内容" />
          </Form.Item>
          <Form.Item name="theme_id" label="所属主题（可选）">
            <Input placeholder="关联的主题 ID，留空表示全局" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
