import { useEffect, useState } from 'react';
import { Modal, Select, Space, Typography, Button, Progress, Tag, Empty } from 'antd';
import { MobileOutlined, SendOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../utils/tauri';
import { useThemePush } from '../hooks/useThemePush';
import type { ClientInfo } from '../types/theme';

const { Text } = Typography;

const T_TITLE = '\u63a8\u9001\u5230\u624b\u673a';
const T_DEVICE = '\u76ee\u6807\u8bbe\u5907';
const T_NO_DEVICE = '\u65e0\u53ef\u7528\u8bbe\u5907';
const T_THEME = '\u4e3b\u9898\u5305';
const T_PROGRESS = '\u63a8\u9001\u8fdb\u5ea6';
const T_SENT = '\u5df2\u53d1\u9001';
const T_SPEED = '\u901f\u5ea6';
const T_STATUS = '\u72b6\u6001';
const T_PACKING = '\u6b63\u5728\u6253\u5305...';
const T_WAITING = '\u7b49\u5f85\u624b\u673a\u786e\u8ba4...';
const T_PUSHING = '\u6b63\u5728\u63a8\u9001...';
const T_COMPLETED = '\u63a8\u9001\u5b8c\u6210';
const T_FAILED = '\u63a8\u9001\u5931\u8d25';
const T_CANCELLED = '\u5df2\u53d6\u6d88';
const T_IDLE = '\u51c6\u5907\u4e2d';
const T_START = '\u5f00\u59cb\u63a8\u9001';
const T_CANCEL = '\u53d6\u6d88';
const T_RETRY = '\u91cd\u4f20';
const T_RESUME = '\u7ee7\u7eed';
const T_CLOSE = '\u5173\u95ed';
const T_CONNECTED = '\u5df2\u8fde\u63a5';
const T_NEED_START = '\u8bf7\u5148\u542f\u52a8\u670d\u52a1\u5e76\u8fde\u63a5\u8bbe\u5907';
const T_INTERRUPTED = '\u4f20\u8f93\u5df2\u4e2d\u65ad\uff08\u5df2\u4f20\u8f93';
const T_ASK_CONTINUE = '\uff09\uff0c\u662f\u5426\u7ee7\u7eed\uff1f';

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'packing': return T_PACKING;
    case 'awaiting_confirm': return T_WAITING;
    case 'pushing': return T_PUSHING;
    case 'completed': return T_COMPLETED;
    case 'failed': return T_FAILED;
    case 'cancelled': return T_CANCELLED;
    default: return T_IDLE;
  }
}

interface Props {
  themeId: string;
  themeName: string;
  themeVersion: string;
  open: boolean;
  onClose: () => void;
}

export default function PushDialog({ themeId, themeName, themeVersion, open, onClose }: Props) {
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
      title={<span><MobileOutlined style={{ marginRight: 8 }} />{T_TITLE}</span>}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          {active ? (
            <Button danger onClick={cancelPush}>{T_CANCEL}</Button>
          ) : failed ? (
            <>
              {canResume && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={resumePush}>{T_RESUME}</Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={retryPush}>{T_RETRY}</Button>
              <Button onClick={onClose}>{T_CLOSE}</Button>
            </>
          ) : (
            <>
              <Button type="primary" icon={<SendOutlined />} disabled={!canStart} onClick={() => startPush(themeId, deviceId)}>
                {T_START}
              </Button>
              <Button onClick={onClose}>{T_CLOSE}</Button>
            </>
          )}
        </Space>
      }
      width={480}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {devices.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T_NEED_START} />
        ) : (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{T_DEVICE}</Text>
            <Select
              value={deviceId || undefined}
              onChange={setDeviceId}
              placeholder={T_NO_DEVICE}
              style={{ width: '100%' }}
              options={devices.map((d) => ({
                value: d.client_id,
                label: (
                  <span>
                    {d.device_name || '\u672a\u77e5\u8bbe\u5907'} <Tag color="green" style={{ marginLeft: 4 }}>{T_CONNECTED}</Tag>
                  </span>
                ),
              }))}
            />
          </div>
        )}

        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>{T_THEME}</Text>
          <Text strong>{themeName} <Text type="secondary">v{themeVersion}</Text></Text>
        </div>

        {active && state.totalSize > 0 && (
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>{T_PROGRESS}</Text>
            <Progress
              percent={Math.round(state.progress)}
              status={state.status === 'awaiting_confirm' || state.stage === 'start' ? 'normal' : 'active'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <Text type="secondary">{T_SENT}: {formatBytes(state.sentSize)} / {formatBytes(state.totalSize)}</Text>
              <Text type="secondary">{T_SPEED}: {Math.round(state.speed)} KB/s</Text>
            </div>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary">{T_STATUS}: </Text>
              <Tag color={state.status === 'awaiting_confirm' || state.stage === 'start' ? 'warning' : 'processing'}>
                {statusLabel(state.status)}
              </Tag>
            </div>
          </div>
        )}

        {state.status === 'completed' && <Text type="success">{T_COMPLETED} ✓</Text>}

        {failed && (
          <div>
            {canResume && (
              <Text type="warning" style={{ display: 'block', marginBottom: 4 }}>
                {T_INTERRUPTED} {interruptedPct}%{T_ASK_CONTINUE}
              </Text>
            )}
            <Text type="danger" style={{ display: 'block' }}>
              {T_FAILED}: {state.errorMessage || '\u672a\u77e5\u9519\u8bef'}
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {'\u53ef\u70b9\u51fb\u7ee7\u7eed\u4ece\u4e2d\u65ad\u5904\u7ee7\u7eed\uff0c\u6216\u91cd\u4f20\u4ece\u5934\u5f00\u59cb'}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}
