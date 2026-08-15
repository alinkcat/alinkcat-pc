import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tauriInvoke } from '../utils/tauri';
import ThemeCover from '../components/ThemeCover';
import ThemeTable from '../components/ThemeTable';
import PushDialog from '../components/PushDialog';
import { getThemeSource, sourceLabel, sourceTagColor } from '../utils/themeSource';
import {
  Card,
  Row,
  Col,
  Button,
  Spin,
  Empty,
  Badge,
  Modal,
  Typography,
  Space,
  Tag,
  Segmented,
  Tabs,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SwapOutlined,
  EditOutlined,
  ExportOutlined,
  MobileOutlined,
  CloudUploadOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { useDownloadStore } from '../store/downloadStore';
import type { ThemeSummary } from '../types/theme';

const { Text } = Typography;
const VIEW_KEY = 'themes_view';

type ThemeCategory = 'all' | 'local' | 'downloaded' | 'pending';

export default function Themes() {
  const navigate = useNavigate();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<'card' | 'table'>(() => localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'card');
  const [category, setCategory] = useState<ThemeCategory>('all');
  const [pushTarget, setPushTarget] = useState<ThemeSummary | null>(null);
  const { queue, importTheme, importAll, remove, importing: queueImporting } = useDownloadStore();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, active] = await Promise.all([
        tauriInvoke<ThemeSummary[]>('scan_themes'),
        tauriInvoke<string | null>('get_active_theme'),
      ]);
      setThemes(list);
      setActiveId(active);
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = themes.filter((t) => {
    if (category === 'all' || category === 'pending') return true;
    const src = getThemeSource(t);
    return category === 'downloaded' ? src === 'downloaded' : src === 'local';
  });

  const handleViewChange = (v: string | number) => {
    const next = v as 'card' | 'table';
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  };

  const handleImport = async () => {
    let file: string | null = null;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      file = await open({
        multiple: false,
        filters: [{ name: '主题包', extensions: ['alc', 'zip'] }],
      });
    } catch {
      message.error('无法打开文件选择器');
      return;
    }
    if (!file) return;
    setImporting(true);
    try {
      await tauriInvoke('import_theme', { path: file });
      message.success('主题包导入成功');
      fetchData();
    } catch (e) {
      message.error(String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleExportTheme = async (theme: ThemeSummary) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const path = await save({
        defaultPath: `${theme.name}_${theme.version}.alc`,
        filters: [{ name: '主题包 (.alc)', extensions: ['alc'] }],
      });
      if (!path) return;
      await tauriInvoke('export_theme', { id: theme.id, outputPath: path });
      message.success('导出成功');
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await tauriInvoke('activate_theme', { id });
      setActiveId(id);
      // 广播 theme.switch 消息给所有已连接的手机端
      try {
        await tauriInvoke('broadcast', {
          message: JSON.stringify({
            jsonrpc: '2.0',
            method: 'theme.switch',
            params: { themeId: id },
          }),
        });
      } catch {
        // WebSocket 服务未运行 — 忽略广播异常
      }
      message.success('主题切换成功');
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除主题包「${name}」吗？删除后无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await tauriInvoke('delete_theme', { id });
          message.success('主题包已删除');
          fetchData();
        } catch (e) {
          message.error(String(e));
        }
      },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">主题包管理</h1>
          <p className="page-subtitle">管理、创建和分发主题包资源</p>
        </div>
        <Space wrap>
          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => navigate('/upload-center')}
          >
            上传主题
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/themes/edit/new')}
          >
            新建主题包
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={importing}
            onClick={handleImport}
          >
            导入主题包
          </Button>
        </Space>
      </div>

      <div className="themes-toolbar">
        <Tabs
          activeKey={category}
          onChange={(k) => setCategory(k as ThemeCategory)}
          items={[
            { key: 'all', label: '全部' },
            { key: 'local', label: '本地' },
            { key: 'downloaded', label: '已下载' },
            { key: 'pending', label: `待导入 (${queue.length})` },
          ]}
          style={{ marginBottom: 0 }}
        />
        <Segmented
          value={view}
          onChange={handleViewChange}
          options={[
            { value: 'card', icon: <AppstoreOutlined /> },
            { value: 'table', icon: <UnorderedListOutlined /> },
          ]}
        />
      </div>

      {category === 'pending' ? (
        queue.length === 0 ? (
          <Empty description="暂无待导入的主题包" style={{ padding: '80px 0' }}>
            <Button type="primary" onClick={() => navigate('/market')}>去主题市场逛逛</Button>
          </Empty>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text type="secondary">{queue.length} 个主题包待导入</Text>
              <Space>
                <Button size="small" icon={<ImportOutlined />} loading={queueImporting} onClick={importAll}>全部导入</Button>
                <Button size="small" danger onClick={() => { Modal.confirm({ title: '清空待导入列表', content: '确定要删除所有已下载的包体吗？', onOk: () => useDownloadStore.getState().clear() }); }}>清空</Button>
              </Space>
            </div>
            <Row gutter={[16, 16]}>
              {queue.map((item) => (
                <Col key={item.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    className="theme-card"
                    actions={[
                      <Button type="primary" size="small" icon={<ImportOutlined />} loading={queueImporting}
                        onClick={() => { importTheme(item.themeId).then(() => message.success('导入成功')).catch((e) => message.error(String(e))); }}>
                        导入
                      </Button>,
                      <Button size="small" danger icon={<DeleteOutlined />}
                        onClick={() => { remove(item.themeId); message.success('已删除'); }}>
                        删除
                      </Button>,
                    ]}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>v{item.version} · {item.author}</Text>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                      下载于 {new Date(item.downloadedAt).toLocaleString()}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          description={category === 'all' ? '暂无主题包' : '该分类下暂无主题包'}
          style={{ padding: '80px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleImport}>
            导入主题包
          </Button>
        </Empty>
      ) : view === 'table' ? (
        <ThemeTable
          themes={filtered}
          activeId={activeId}
          onEdit={(id) => navigate(`/themes/edit/${id}`)}
          onActivate={handleActivate}
          onExport={handleExportTheme}
          onDelete={handleDelete}
          onPush={setPushTarget}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((theme) => {
            const isActive = theme.id === activeId;
            const src = getThemeSource(theme);

            return (
              <Col key={theme.id} xs={24} sm={12} md={8} lg={8} xl={6}>
                <Badge.Ribbon text="当前使用" color="#4F6EF7" style={{ display: isActive ? 'block' : 'none' }}>
                  <Card
                    hoverable
                    className={`theme-card ${isActive ? 'theme-card-active' : ''}`}
                    cover={
                      <div className="theme-card-cover">
                        <ThemeCover
                          themeId={theme.id}
                          themeName={theme.name}
                          coverUrl={theme.cover_url}
                          hasCover={theme.has_cover}
                        />
                      </div>
                    }
                    styles={{ body: { padding: 12 } }}
                  >
                    <Card.Meta
                      title={
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {theme.name}
                          <Tag color={sourceTagColor(src)} style={{ marginRight: 0 }}>{sourceLabel(src)}</Tag>
                          {isActive && (
                            <Badge
                              count="当前使用"
                              style={{ backgroundColor: '#4F6EF7', fontSize: 11, fontWeight: 400 }}
                            />
                          )}
                        </span>
                      }
                      description={
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            v{theme.version} · {theme.author}
                          </Text>
                          {theme.description && (
                            <p style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                              {theme.description}
                            </p>
                          )}
                        </div>
                      }
                    />
                    <div className="theme-card-actions">
                      <Space wrap size={[4, 4]}>
                        <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/themes/edit/${theme.id}`)}>
                          编辑
                        </Button>
                        <Button size="small" icon={<MobileOutlined />} onClick={() => setPushTarget(theme)}>
                          推送
                        </Button>
                        <Button size="small" icon={<SwapOutlined />} disabled={isActive} onClick={() => handleActivate(theme.id)}>
                          {isActive ? '已激活' : '切换'}
                        </Button>
                        <Button size="small" icon={<ExportOutlined />} onClick={() => handleExportTheme(theme)}>
                          导出
                        </Button>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(theme.id, theme.name)}>
                          删除
                        </Button>
                      </Space>
                    </div>
                  </Card>
                </Badge.Ribbon>
              </Col>
            );
          })}
        </Row>
      )}

      <PushDialog
        themeId={pushTarget?.id ?? ''}
        themeName={pushTarget?.name ?? ''}
        themeVersion={pushTarget?.version ?? ''}
        open={!!pushTarget}
        onClose={() => setPushTarget(null)}
      />
    </div>
  );
}
