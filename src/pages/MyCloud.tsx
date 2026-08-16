import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Statistic, Button, Table, Typography, Space, Progress, Modal, Checkbox,
} from 'antd';
import {
  CloudUploadOutlined, DeleteOutlined, DownloadOutlined, AppstoreOutlined, CloudSyncOutlined,
} from '@ant-design/icons';
import { cloudApi } from '../api/cloudApi';
import { useAuthStore } from '../store/authStore';
import { useMessage } from '../hooks/useMessage';
import { tauriInvoke } from '../utils/tauri';
import type { CloudFile, CloudSpace } from '../api/types';
import type { ThemeSummary } from '../types/theme';

const { Text } = Typography;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export default function MyCloud() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isLoggedIn } = useAuthStore();
  const { message: msg } = useMessage();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [space, setSpace] = useState<CloudSpace | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [localThemes, setLocalThemes] = useState<ThemeSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listResp, spaceResp] = await Promise.all([
        cloudApi.list({ page: 1, size: 50 }),
        cloudApi.space(),
      ]);
      if (listResp.code === 200 && listResp.data) setFiles(listResp.data.records);
      if (spaceResp.code === 200) setSpace(spaceResp.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [isLoggedIn]);

  const openUploadModal = async () => {
    try {
      const themes = await tauriInvoke<ThemeSummary[]>('scan_themes');
      setLocalThemes(themes);
      setSelectedIds([]);
      setUploadOpen(true);
    } catch (e) { msg.error(String(e)); }
  };

  const handleUpload = async () => {
    if (selectedIds.length === 0) return msg.warning(t('cloud.selectAtLeastOne'));
    setUploading(true);
    let success = 0;
    for (const themeId of selectedIds) {
      try {
        const packed = await tauriInvoke<{ base64: string; size: number; hash: string }>('pack_theme_data', { themeId });
        const themeBlob = new Blob([Uint8Array.from(atob(packed.base64), c => c.charCodeAt(0))], { type: 'application/zip' });
        const themeFile = new File([themeBlob], `${themeId}.alc`, { type: 'application/zip' });
        const fd = new FormData();
        fd.append('file', themeFile);
        await cloudApi.upload(fd);
        success++;
      } catch (e) { msg.error(t('cloud.uploadFailed', { id: themeId, error: String(e) })); }
    }
    if (success > 0) {
      msg.success(t('cloud.uploadSuccess', { count: success }));
      fetchData();
    }
    setUploading(false);
    setUploadOpen(false);
  };

  const handleDelete = (id: number, name: string) => {
    Modal.confirm({
      title: t('cloud.deleteConfirmTitle'),
      content: t('cloud.deleteConfirmContent', { name }),
      onOk: async () => {
        try {
          await cloudApi.delete(id);
          msg.success(t('cloud.deleted'));
          fetchData();
        } catch (e) { msg.error(String(e)); }
      },
    });
  };

  const handleDownload = async (item: CloudFile) => {
    try {
      const resp = await cloudApi.downloadUrl(item.id);
      if (resp.code === 200 && resp.data) {
        // Download to downloads dir and import
        const filename = item.originalName || item.fileName;
        const filePath = await tauriInvoke<string>('download_theme_file', { url: resp.data, filename });
        await tauriInvoke('import_theme_from_file', { path: filePath });
        msg.success(t('cloud.restored'));
        fetchData();
      } else {
        msg.warning(t('cloud.downloadFailed'));
      }
    } catch (e) { msg.error(String(e)); }
  };

  const handleSyncToDevice = async (item: CloudFile) => {
    try {
      // 1. Download cloud backup
      const resp = await cloudApi.downloadUrl(item.id);
      if (resp.code !== 200 || !resp.data) {
        msg.warning(t('cloud.downloadFailed'));
        return;
      }
      const filename = item.originalName || item.fileName;
      const filePath = await tauriInvoke<string>('download_theme_file', { url: resp.data, filename });
      await tauriInvoke('import_theme_from_file', { path: filePath });

      // 2. Get connected devices
      const devices = await tauriInvoke<import('../types/theme').ClientInfo[]>('get_connections');
      if (devices.length === 0) {
        msg.warning(t('themes.noDevices'));
        return;
      }

      // 3. Scan to find the imported theme ID
      const themes = await tauriInvoke<import('../types/theme').ThemeSummary[]>('scan_themes');
      const themeName = (item.originalName || item.fileName).replace(/\.alc$/, '');
      const theme = themes.find(t => t.name === themeName);
      if (!theme) {
        msg.error(t('themes.themeNotFound'));
        return;
      }

      // 4. Push to all devices
      let successCount = 0;
      for (const device of devices) {
        try {
          await tauriInvoke('push_theme_to_device', {
            themeId: theme.id,
            clientId: device.client_id,
            startChunk: 0,
          });
          successCount++;
        } catch (e) {
          console.error('Failed to sync to device ' + device.device_name, e);
        }
      }
      if (successCount > 0) {
        msg.success(t('themes.syncSuccess', { count: successCount }));
      }
    } catch (e) { msg.error(String(e)); }
  };

  if (!isLoggedIn) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="page-title">{t('cloud.title')}</h1></div>
        <Card style={{ textAlign: 'center', padding: 40 }}><Button type="primary" onClick={() => navigate('/auth')}>{t('cloud.loginRequired')}</Button></Card>
      </div>
    );
  }

  const columns = [
    { title: t('cloud.themeName'), dataIndex: 'originalName', ellipsis: true, render: (v: string) => (v || '').replace(/\.alc$/, '') || t('cloud.unknownTheme'), },
    { title: t('cloud.size'), dataIndex: 'fileSize', width: 100, render: (s: number) => formatSize(s) },
    { title: t('cloud.backupTime'), dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('cloud.actions'), width: 160,
      render: (_: unknown, r: CloudFile) => (
        <Space>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>{t('cloud.restore')}</Button>
          <Button size="small" icon={<CloudSyncOutlined />} onClick={() => handleSyncToDevice(r)}>{t('themes.syncToDevice')}</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id, r.fileName)}>{t('cloud.delete')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('cloud.title')}</h1>
        <p className="page-subtitle">{t('cloud.subtitle')}</p>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={t('cloud.backupCount')} value={space?.totalFiles ?? 0} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card>
            <div style={{ marginBottom: 8 }}><Text type="secondary">{t('cloud.cloudSpace')}</Text></div>
            <Progress
              percent={space ? Math.round((space.totalBytes / Math.max(space.maxTotalBytes, 1)) * 100) : 0}
              format={() => `${formatSize(space?.totalBytes ?? 0)} / ${formatSize(space?.maxTotalBytes ?? 0)}`}
            />
          </Card>
        </Col>
      </Row>
      <Card
        title={t('cloud.backupList')}
        style={{ marginTop: 16 }}
        extra={
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={openUploadModal}>
            {t('cloud.backupToCloud')}
          </Button>
        }
      >
        <Table
          dataSource={files}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: t('cloud.emptyTable') }}
        />
      </Card>

      <Modal
        title={t('cloud.selectThemeTitle')}
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={handleUpload}
        okText={t('cloud.selectTheme', { count: selectedIds.length })}
        confirmLoading={uploading}
        width={520}
      >
        {localThemes.length === 0 ? (
          <Text type="secondary">{t('cloud.noLocalThemes')}</Text>
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {localThemes.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px',
                  borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                }}
                onClick={() => {
                  setSelectedIds((prev) =>
                    prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                  );
                }}
              >
                <Checkbox checked={selectedIds.includes(t.id)} />
                <div>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>v{t.version} · {t.author}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}