import { Table, Button, Tag, Space, Typography } from 'antd';
import { EditOutlined, SwapOutlined, ExportOutlined, DeleteOutlined, MobileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const columns = [
    {
      title: t('themes.cover'),
      dataIndex: 'id',
      key: 'cover',
      width: 90,
      render: (_: string, record: ThemeSummary) => (
        <div style={{ width: 64, height: 40, borderRadius: 4, overflow: 'hidden' }}>
          <ThemeCover themeId={record.id} themeName={record.name} coverUrl={record.cover_url} hasCover={record.has_cover} />
        </div>
      ),
    },
    {
      title: t('themes.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ThemeSummary, b: ThemeSummary) => a.name.localeCompare(b.name),
      render: (name: string, record: ThemeSummary) => (
        <Space>
          <Text strong>{name}</Text>
          {record.id === activeId && <Tag color="#4F6EF7">{t('themes.activated')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('themes.version'),
      dataIndex: 'version',
      key: 'version',
      width: 90,
    },
    {
      title: t('themes.author'),
      dataIndex: 'author',
      key: 'author',
      width: 110,
      render: (v: string) => v || '-',
    },
    {
      title: t('themes.source'),
      key: 'source',
      width: 90,
      render: (_: unknown, record: ThemeSummary) => {
        const src = getThemeSource(record);
        return <Tag color={sourceTagColor(src)}>{sourceLabel(src)}</Tag>;
      },
    },
    {
      title: t('themes.actions'),
      key: 'actions',
      width: 220,
      render: (_: unknown, record: ThemeSummary) => (
        <Space size={0} wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>{t('themes.edit')}</Button>
          <Button type="link" size="small" icon={<MobileOutlined />} onClick={() => onPush(record)}>{t('themes.push')}</Button>
          <Button type="link" size="small" icon={<SwapOutlined />} disabled={record.id === activeId} onClick={() => onActivate(record.id)}>
            {record.id === activeId ? t('themes.activated') : t('themes.activate')}
          </Button>
          <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => onExport(record)}>{t('themes.export')}</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record.id, record.name)}>{t('themes.delete')}</Button>
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
      locale={{ emptyText: t('themes.emptyText') }}
    />
  );
}
