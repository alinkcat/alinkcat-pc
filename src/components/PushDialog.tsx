import { useEffect, useState } from 'react';
import { Modal, Select, Space, Typography, Button, Progress, Tag, Empty } from 'antd';
import { MobileOutlined, SendOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { tauriInvoke } from '../utils/tauri';
import { useThemePush } from '../hooks/useThemePush';
import type { ClientInfo } from '../types/theme';

const { Text } = Typography;

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

interface Props {
  themeId: string;
  themeName: string;
  themeVersion: string;
  open: boolean;
  onClose: () => void;
}

export default function PushDialog({ themeId, themeName, themeVersion, open, onClose }: Props) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<ClientInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const { state, startPush, resumePush, retryPush, cancelPush, reset } = useThemePush();

  useEffect(() => {
    if (!open) return;
    setDeviceId('');
    reset();
    tauriInvoke<ClientInfo[]>('get_connections').then(setDevices).catch(() => setDevices([]));
  }, [open, reset]);

  const active = state.status === 'pushing' || state.status === 'packing' || state.status === 'awaiting_confirm';
  const canStart = !!deviceId && !active;
  const failed = state.status === 'failed';
  const canResume = failed && state.resumeChunk > 0;
  const interruptedPct = state.totalChunks > 0
    ? Math.round((state.currentChunk / state.totalChunks) * 100)
    : state.progress;

  return (
    <Modal
      title={<span><MobileOutlined style={{ marginRight: 8 }} />{t('push.dialog.title')}</span>}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          {active ? (
            <Button danger onClick={cancelPush}>{t('push.dialog.cancel')}</Button>
          ) : failed ? (
            <>
              {canResume && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={resumePush}>{t('push.dialog.resume')}</Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={retryPush}>{t('push.dialog.retry')}</Button>
              <Button onClick={onClose}>{t('push.dialog.close')}</Button>
            </>
          ) : (
            <>
              <Button type="primary" icon={<SendOutlined />} disabled={!canStart} onClick={() => startPush(themeId, deviceId)}>
                {t('push.dialog.start')}
              </Button>
              <Button onClick={onClose}>{t('push.dialog.close')}</Button>
            </>
          )}
        </Space>
      }
      width={480}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {devices.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('push.dialog.needStart')} />
        ) : (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{t('push.dialog.device')}</Text>
            <Select
              value={deviceId || undefined}
              onChange={setDeviceId}
              placeholder={t('push.dialog.noDevice')}
              style={{ width: '100%' }}
              options={devices.map((d) => ({
                value: d.client_id,
                label: (
                  <span>
                    {d.device_name || t('push.dialog.unknownDevice')} <Tag color="green" style={{ marginLeft: 4 }}>{t('push.dialog.connected')}</Tag>
                  </span>
                ),
              }))}
            />
          </div>
        )}

        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>{t('push.dialog.theme')}</Text>
          <Text strong>{themeName} <Text type="secondary">v{themeVersion}</Text></Text>
        </div>

        {active && state.totalSize > 0 && (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{t('push.dialog.progress')}</Text>
            <Progress
              percent={Math.round(state.progress)}
              status={state.status === 'awaiting_confirm' || state.stage === 'start' ? 'normal' : 'active'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <Text type="secondary">{t('push.dialog.sent')}: {formatBytes(state.sentSize)} / {formatBytes(state.totalSize)}</Text>
              <Text type="secondary">{t('push.dialog.speed')}: {Math.round(state.speed)} KB/s</Text>
            </div>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary">{t('push.dialog.status')}: </Text>
              <Tag color={state.status === 'awaiting_confirm' || state.stage === 'start' ? 'warning' : 'processing'}>
                {t(`push.status.${state.status}`)}
              </Tag>
            </div>
          </div>
        )}

        {state.status === 'completed' && <Text type="success">{t('push.status.completed')} ✓</Text>}

        {failed && (
          <div>
            {canResume && (
              <Text type="warning" style={{ display: 'block', marginBottom: 4 }}>
                {t('push.dialog.interrupted', { pct: interruptedPct })}
              </Text>
            )}
            <Text type="danger" style={{ display: 'block' }}>
              {t('push.status.failed')}: {state.errorMessage || t('push.dialog.unknownError')}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {t('push.dialog.resumeHint')}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}