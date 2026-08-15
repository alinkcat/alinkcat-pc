import { Table, Button, Tag, Space, Typography } from 'antd';
import { EditOutlined, SwapOutlined, ExportOutlined, DeleteOutlined, MobileOutlined } from '@ant-design/icons';
import ThemeCover from './ThemeCover';
import { getThemeSource, sourceLabel, sourceTagColor } from '../utils/themeSource';
import type { ThemeSummary } from '../types/theme';

const { Text } = Typography;

interface Props {
  themes: ThemeSummary[];
  activeId: string | null;
  onEdit: (id: string) => void;
  onActivate: (id: string) => void;
  onExport: (theme: ThemeSummary) => void;
  onDelete: (id: string, name: string) => void;
  onPush: (theme: ThemeSummary) => void;
}

export default function ThemeTable({ themes, activeId, onEdit, onActivate, onExport, onDelete, onPush }: Props) {
  const columns = [
    {
      title: '封面',
      dataIndex: 'id',
      key: 'cover',
      width: 90,
      render: (_: string, t: ThemeSummary) => (
        <div style={{ width: 64, height: 40, borderRadius: 4, overflow: 'hidden' }}>
          <ThemeCover themeId={t.id} themeName={t.name} coverUrl={t.cover_url} hasCover={t.has_cover} />
        </div>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ThemeSummary, b: ThemeSummary) => a.name.localeCompare(b.name),
      render: (name: string, t: ThemeSummary) => (
        <Space>
          <Text strong>{name}</Text>
          {t.id === activeId && <Tag color="#4F6EF7">已激活</Tag>}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 90,
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 110,
      render: (v: string) => v || '-',
    },
    {
      title: '来源',
      key: 'source',
      width: 90,
      render: (_: unknown, t: ThemeSummary) => {
        const src = getThemeSource(t);
        return <Tag color={sourceTagColor(src)}>{sourceLabel(src)}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, t: ThemeSummary) => (
        <Space size={0} wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(t.id)}>编辑</Button>
          <Button type="link" size="small" icon={<MobileOutlined />} onClick={() => onPush(t)}>推送</Button>
          <Button type="link" size="small" icon={<SwapOutlined />} disabled={t.id === activeId} onClick={() => onActivate(t.id)}>
            {t.id === activeId ? '已激活' : '切换'}
          </Button>
          <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => onExport(t)}>导出</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(t.id, t.name)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <Table
      dataSource={themes}
      columns={columns}
      rowKey="id"
      pagination={{ pageSize: 10, showSizeChanger: false }}
      size="middle"
      locale={{ emptyText: '暂无主题包' }}
    />
  );
}
