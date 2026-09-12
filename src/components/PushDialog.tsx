import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Select, Space, Typography, Button, Progress, Tag, Empty, Checkbox } from 'antd';
import { MobileOutlined, SendOutlined, ReloadOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
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

function statusLabel(t: ReturnType<typeof useTranslation>['t'], status: string): string {
  switch (status) {
    case 'idle': return t('push.status.idle');
    case 'packing': return t('push.status.packing');
    case 'awaiting_confirm': return t('push.status.awaiting_confirm');
    case 'connecting': return t('push.status.connecting');
    case 'pushing': return t('push.status.pushing');
    case 'completed': return t('push.status.completed');
    case 'failed': return t('push.status.failed');
    case 'cancelled': return t('push.status.cancelled');
    case 'retrying': return t('push.status.retrying');
    default: return status;
  }
}

export default function PushDialog({ themeId, themeName, themeVersion, open, onClose }: Props) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<ClientInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const { state, startPush, resumePush, retryPush, cancelPush, cancelAutoRetry, reset } = useThemePush();
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setSelectAll(false);
    reset();
    startTimeRef.current = 0;
    tauriInvoke<ClientInfo[]>('get_connections')
      .then((list) => setDevices(list.filter((d) => !d.device_name.includes('(Display)'))))
      .catch(() => setDevices([]));
  }, [open, reset]);

  // 记录推送开始时间（用于 ETA 计算）
  useEffect(() => {
    if (state.status === 'pushing' && state.sentSize > 0 && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
      startTimeRef.current = 0;
    }
  }, [state.status, state.sentSize]);

  // 计算预计剩余时间（ETA）
  const etaText = useMemo(() => {
    if (state.status !== 'pushing' || state.speed <= 0 || state.sentSize <= 0) return null;
    const remaining = state.totalSize - state.sentSize;
    const etaSeconds = Math.ceil(remaining / (state.speed * 1024));
    if (etaSeconds <= 0) return null;
    if (etaSeconds < 60) {
      return t('push.dialog.etaSeconds', { s: etaSeconds });
    }
    const m = Math.floor(etaSeconds / 60);
    const s = etaSeconds % 60;
    return t('push.dialog.etaMinutes', { m, s });
  }, [state.status, state.speed, state.sentSize, state.totalSize, t]);

  const active = state.status === 'pushing' || state.status === 'packing' || state.status === 'awaiting_confirm';
  const failed = state.status === 'failed';
  const retrying = state.status === 'retrying';
  const canStart = selectedIds.length > 0 && !active && !retrying;
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
          ) : retrying ? (
            <>
              <Button icon={<CloseCircleOutlined />} onClick={cancelAutoRetry}>{t('push.dialog.cancelAutoRetry')}</Button>
              <Button onClick={onClose}>{t('push.dialog.close')}</Button>
            </>
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
              <Button type="primary" icon={<SendOutlined />} disabled={!canStart} onClick={() => {
                startTimeRef.current = 0;
                startPush(themeId, selectedIds);
              }}>
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
        {devices.length === 0 && !active && !failed && !retrying ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('push.dialog.needStart')} />
        ) : (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{t('push.dialog.device')}</Text>
            <Checkbox
              checked={selectAll}
              onChange={e => {
                const checked = e.target.checked;
                setSelectAll(checked);
                setSelectedIds(checked ? devices.map(d => d.client_id) : []);
              }}
              style={{ marginBottom: 8 }}
            >
              {t('push.dialog.selectAll') ?? 'Select All'}
            </Checkbox>
            <Select
              mode="multiple"
              placeholder={t('push.dialog.noDevice') ?? 'Select device(s)'}
              value={selectedIds}
              onChange={setSelectedIds}
              style={{ width: '100%' }}
              disabled={active || retrying}
              showSearch
              filterOption={(input, option) =>
                String(option?.searchLabel ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={devices.map((d) => {
                const name = d.device_name || t('push.dialog.unknownDevice');
                return {
                  value: d.client_id,
                  searchLabel: name,
                  label: (
                    <span>
                      {name} <Tag color="green" style={{ marginLeft: 4 }}>{t('push.dialog.connected')}</Tag>
                    </span>
                  ),
                };
              })}
            />
          </div>
        )}

        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>{t('push.dialog.theme')}</Text>
          <Text strong>{themeName} <Text type="secondary">v{themeVersion}</Text></Text>
        </div>

        {(active || retrying) && state.totalSize > 0 && (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{t('push.dialog.progress')}</Text>
            <Progress
              percent={Math.round(state.progress)}
              status={state.status === 'retrying' ? 'exception' : (state.status === 'awaiting_confirm' || state.stage === 'start' ? 'normal' : 'active')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <Text type="secondary">{t('push.dialog.sent')}: {formatBytes(state.sentSize)} / {formatBytes(state.totalSize)}</Text>
              <Text type="secondary">{t('push.dialog.speed')}: {Math.round(state.speed)} KB/s</Text>
            </div>
            {/* ETA 显示 */}
            {etaText && state.status === 'pushing' && (
              <div style={{ marginTop: 4, fontSize: 12 }}>
                <Text type="secondary">{t('push.dialog.eta')}: {etaText}</Text>
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              <Text type="secondary">{t('push.dialog.status')}: </Text>
              <Tag color={state.status === 'retrying' ? 'error' : (state.status === 'awaiting_confirm' || state.stage === 'start' ? 'warning' : 'processing')}>
                {statusLabel(t, state.status)}
              </Tag>
              {/* 自动重试提示 */}
              {state.status === 'retrying' && (
                <Text type="warning" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  {t('push.dialog.autoRetry', { n: state.autoRetryCount, max: 2 })}
                </Text>
              )}
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