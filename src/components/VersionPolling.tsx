import { useEffect, useState } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { APP_VERSION } from '../config';
import { clientVersionApi } from '../api/clientVersionApi';

const { Text } = Typography;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 分钟
const SEEN_KEY = 'ilinkcat_seen_announcements';

function getSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSeen(id: number) {
  const set = getSeenIds();
  set.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
}

/**
 * 定期轮询版本状态，发现强制更新或弹窗公告时立即显示。
 * 嵌入 App 根组件，与 App 同生命周期。
 */
export default function VersionPolling() {
  const [modal, setModal] = useState<{
    type: 'deprecated' | 'maintenance' | 'force_update' | 'announcement';
    message: string; url?: string | null; changelog?: string | null; title?: string;
  } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await clientVersionApi.check('windows', APP_VERSION);
        if (resp.code !== 200 || !resp.data) return;

        const { version, announcements } = resp.data;

        // 版本控制（优先级最高）
        if (version.status === 2) {
          setModal({ type: 'deprecated', message: '当前版本已停止服务，请升级到最新版本', url: version.updateUrl });
          return;
        }
        if (version.forceUpdate === 1) {
          setModal({ type: 'force_update', message: '请升级到最新版本以继续使用', url: version.updateUrl, changelog: version.changelog });
          return;
        }
        if (version.status === 1) {
          setModal({ type: 'maintenance', message: '系统正在维护中，部分功能可能不可用', url: version.updateUrl });
          return;
        }

        // 弹窗公告
        const seen = getSeenIds();
        const now = new Date().toISOString();
        const valid = announcements.filter((a) => {
          if (a.status !== 1) return false;
          if (a.targetPlatform && a.targetPlatform !== 'windows') return false;
          if (a.popupType === 'once' && seen.has(a.id)) return false;
          if (a.startAt && a.startAt > now) return false;
          if (a.endAt && a.endAt < now) return false;
          return true;
        });

        if (valid.length > 0) {
          const a = valid[0];
          markSeen(a.id);
          setModal({ type: 'announcement', title: a.title, message: a.content || '' });
        }
      } catch { /* 网络错误静默忽略 */ }
    };

    // 首次延迟 30 秒（避免与启动检查冲突），然后每 5 分钟轮询
    const initial = setTimeout(check, 30_000);
    const timer = setInterval(check, POLL_INTERVAL);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, []);

  const handleClose = () => setModal(null);

  const handleAction = () => {
    if (!modal) return;
    if (modal.type === 'deprecated' || modal.type === 'force_update') {
      if (modal.url) window.open(modal.url, '_blank');
      window.close();
    } else {
      setModal(null);
    }
  };

  if (!modal) return null;

  const isBlocking = modal.type === 'deprecated' || modal.type === 'force_update';

  return (
    <Modal open closable={!isBlocking} footer={null} width={400} centered onCancel={handleClose}>
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {modal.type === 'announcement' ? '📢' : modal.type === 'deprecated' ? '🚫' : '⬆️'}
        </div>
        <Text strong style={{ fontSize: 16 }}>
          {modal.title || (isBlocking ? '版本更新' : '系统维护')}
        </Text>
        <div style={{ marginTop: 12 }}>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{modal.message}</Text>
        </div>
        {modal.changelog && (
          <div style={{ marginTop: 12, padding: 8, background: '#f5f5f5', borderRadius: 6, textAlign: 'left' }}>
            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{modal.changelog}</Text>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          {isBlocking ? (
            <Space>
              {modal.url && <Button type="primary" onClick={handleAction}>下载更新</Button>}
              <Button onClick={handleAction}>退出应用</Button>
            </Space>
          ) : (
            <Button type="primary" onClick={handleClose}>我知道了</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}