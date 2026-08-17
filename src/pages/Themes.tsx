import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Input,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SwapOutlined,
  EditOutlined,
  ExportOutlined,
  MobileOutlined,
  CloudSyncOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ImportOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { useDownloadStore } from '../store/downloadStore';
import TemplatePicker from '../components/TemplatePicker';
import { generateSharePoster, downloadPoster } from '../utils/sharePoster';
import type { ThemeSummary } from '../types/theme';

const { Text } = Typography;
const VIEW_KEY = 'themes_view';

type ThemeCategory = 'all' | 'local' | 'downloaded' | 'pending';

export default function Themes() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<'card' | 'table'>(() => localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'card');
  const [category, setCategory] = useState<ThemeCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pushTarget, setPushTarget] = useState<ThemeSummary | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [sharePoster, setSharePoster] = useState<string | null>(null);
  const [shareTheme, setShareTheme] = useState<ThemeSummary | null>(null);
  const [sharing, setSharing] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const searched = searchQuery
    ? filtered.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filtered;

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
        filters: [{ name: t('themes.themePack'), extensions: ['alc', 'zip'] }],
      });
    } catch {
      message.error(t('themes.cannotOpenFileDialog'));
      return;
    }
    if (!file) return;
    setImporting(true);
    try {
      await tauriInvoke('import_theme', { path: file });
      message.success(t('themes.themeImportSuccess'));
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
        filters: [{ name: t('themes.alcFilter'), extensions: ['alc'] }],
      });
      if (!path) return;
      await tauriInvoke('export_theme', { id: theme.id, outputPath: path });
      message.success(t('themes.exportSuccess'));
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
      message.success(t('themes.themeSwitched'));
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleDelete = (id: string, name: string) => {
    Modal.confirm({
      title: t('themes.confirmDeleteTitle'),
      content: t('themes.confirmDeleteContent', { name }),
      okText: t('themes.confirmDelete'),
      okType: 'danger',
      cancelText: t('themes.cancel'),
      onOk: async () => {
        try {
          await tauriInvoke('delete_theme', { id });
          message.success(t('themes.themeDeleted'));
          fetchData();
        } catch (e) {
          message.error(String(e));
        }
      },
    });
  };

  const handleShare = async (theme: ThemeSummary) => {
    setShareTheme(theme);
    setSharing(true);
    setSharePoster(null);
    try {
      const dataUrl = await generateSharePoster({
        name: theme.name,
        version: theme.version,
        author: theme.author,
        cover_url: theme.cover_url,
      });
      setSharePoster(dataUrl);
    } catch (e) {
      message.error(t('themes.sharePosterFailed'));
    } finally {
      setSharing(false);
    }
  };

  const handleSyncAll = async (theme: ThemeSummary) => {
    setSyncing(true);
    try {
      const devices = await tauriInvoke<import('../types/theme').ClientInfo[]>('get_connections');
      if (devices.length === 0) {
        message.warning(t('themes.noDevices'));
        return;
      }
      let successCount = 0;
      let errorCount = 0;
      for (const device of devices) {
        try {
          // 向每台已连接设备逐个发起主题包推送（复用现有 push_theme_to_device 协议）
          await tauriInvoke('push_theme_to_device', {
            themeId: theme.id,
            clientId: device.client_id,
            startChunk: 0,
          });
          successCount++;
        } catch (e) {
          errorCount++;
          console.error(`Failed to sync to device ${device.device_name}:`, e);
        }
      }
      if (successCount > 0) {
        message.success(t('themes.syncSuccess', { count: successCount }));
      }
      if (errorCount > 0) {
        message.warning(t('themes.syncFailed', { count: errorCount }));
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">{t('themes.themeManagement')}</h1>
          <p className="page-subtitle">{t('themes.themeManagementDesc')}</p>
        </div>
        <Space wrap>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setTemplateOpen(true)}
          >
            {t('themes.newTheme')}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={importing}
            onClick={handleImport}
          >
            {t('themes.importTheme')}
          </Button>
        </Space>
      </div>

      <div className="themes-toolbar">
        <Tabs
          activeKey={category}
          onChange={(k) => setCategory(k as ThemeCategory)}
          items={[
            { key: 'all', label: t('themes.all') },
            { key: 'local', label: t('themes.local') },
            { key: 'downloaded', label: t('themes.downloaded') },
            { key: 'pending', label: t('themes.pendingImportCount', { count: queue.length }) },
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
        <Input.Search
          placeholder={t('themes.searchPlaceholder')}
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onSearch={(v) => setSearchQuery(v)}
          style={{ width: 250, marginBottom: 12 }}
        />
      </div>

      {category === 'pending' ? (
        queue.length === 0 ? (
          <Empty description={t('themes.noPendingThemes')} style={{ padding: '80px 0' }}>
            <Button type="primary" onClick={() => navigate('/market')}>{t('themes.goToMarket')}</Button>
          </Empty>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text type="secondary">{t('themes.pendingCount', { count: queue.length })}</Text>
              <Space>
                <Button size="small" icon={<ImportOutlined />} loading={queueImporting} onClick={importAll}>{t('themes.importAll')}</Button>
                <Button size="small" danger onClick={() => { Modal.confirm({ title: t('themes.clearPendingTitle'), content: t('themes.clearPendingConfirm'), onOk: () => useDownloadStore.getState().clear() }); }}>{t('themes.clearAll')}</Button>
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
                        onClick={() => { importTheme(item.themeId).then(() => message.success(t('themes.importSuccess'))).catch((e) => message.error(String(e))); }}>
                        {t('themes.import')}
                      </Button>,
                      <Button size="small" danger icon={<DeleteOutlined />}
                        onClick={() => { remove(item.themeId); message.success(t('themes.deleted')); }}>
                        {t('themes.delete')}
                      </Button>,
                    ]}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>v{item.version} · {item.author}</Text>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                      {t('themes.downloadedAt', { date: new Date(item.downloadedAt).toLocaleString() })}
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
      ) : searched.length === 0 ? (
        <Empty
          description={category === 'all' ? t('themes.noThemes') : t('themes.noThemesInCategory')}
          style={{ padding: '80px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleImport}>
            {t('themes.importTheme')}
          </Button>
        </Empty>
      ) : view === 'table' ? (
        <ThemeTable
          themes={searched}
          activeId={activeId}
          onEdit={(id) => navigate(`/themes/edit/${id}`)}
          onActivate={handleActivate}
          onExport={handleExportTheme}
          onDelete={handleDelete}
          onPush={setPushTarget}
          onSyncAll={handleSyncAll}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {searched.map((theme) => {
            const isActive = theme.id === activeId;
            const src = getThemeSource(theme);

            return (
              <Col key={theme.id} xs={24} sm={12} md={8} lg={8} xl={6}>
                <Badge.Ribbon text={t('themes.currentUse')} color="#4F6EF7" style={{ display: isActive ? 'block' : 'none' }}>
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
                              count={t('themes.currentUse')}
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
                          {t('themes.edit')}
                        </Button>
                        <Button size="small" icon={<MobileOutlined />} onClick={() => setPushTarget(theme)}>
                          {t('themes.push')}
                        </Button>
                        <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleShare(theme)}>
                          {t('themes.share')}
                        </Button>
                        <Button size="small" icon={<CloudSyncOutlined />} loading={syncing} onClick={() => handleSyncAll(theme)}>
                          {t('themes.syncAll')}
                        </Button>
                        <Button size="small" icon={<SwapOutlined />} disabled={isActive} onClick={() => handleActivate(theme.id)}>
                          {isActive ? t('themes.activated') : t('themes.activate')}
                        </Button>
                        <Button size="small" icon={<ExportOutlined />} onClick={() => handleExportTheme(theme)}>
                          {t('themes.export')}
                        </Button>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(theme.id, theme.name)}>
                          {t('themes.delete')}
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

      {/* 从模板新建 */}
      <TemplatePicker
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
      />

      {/* 分享海报 Modal */}
      <Modal
        title={t('themes.sharePoster')}
        open={!!shareTheme}
        onCancel={() => { setShareTheme(null); setSharePoster(null); }}
        footer={
          sharePoster ? (
            <Button type="primary" onClick={() => downloadPoster(sharePoster!, `${shareTheme?.name || 'theme'}-poster.png`)}>
              {t('themes.downloadPoster')}
            </Button>
          ) : null
        }
        width={480}
        destroyOnHidden
      >
        {sharing ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#8c8c8c' }}>{t('themes.sharePosterLoading')}</p>
          </div>
        ) : sharePoster ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={sharePoster}
              alt={t('themes.sharePoster')}
              style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
