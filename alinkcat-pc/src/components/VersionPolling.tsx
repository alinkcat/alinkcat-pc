import { useEffect, useState } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { APP_VERSION , APP_PLATFORM } from '../config';
import { clientVersionApi } from '../api/clientVersionApi';

const { Text } = Typography;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 min
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

/** polls version status, shows force-update / announcement modals as soon as they appear. mounted at the App root */
export default function VersionPolling() {
  const { t } = useTranslation();
  const [modal, setModal] = useState<{
    type: 'deprecated' | 'maintenance' | 'force_update' | 'announcement';
    message: string; url?: string | null; changelog?: string | null; title?: string;
  } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await clientVersionApi.check(APP_PLATFORM, APP_VERSION);
        if (resp.code !== 200 || !resp.data) return;

        const { version, announcements } = resp.data;

        // version gate first, highest priority
        if (version.status === 2) {
          setModal({ type: 'deprecated', message: t('versionGate.deprecated'), url: version.updateUrl });
          return;
        }
        if (version.forceUpdate === 1) {
          setModal({ type: 'force_update', message: t('versionGate.forceUpdate'), url: version.updateUrl, changelog: version.changelog });
          return;
        }
        if (version.status === 1) {
          setModal({ type: 'maintenance', message: t('versionGate.maintenance'), url: version.updateUrl });
          return;
        }

        // popup announcements
        const seen = getSeenIds();
        const now = new Date().toISOString();
        const valid = announcements.filter((a) => {
          if (a.status !== 1) return false;
          if (a.targetPlatform && a.targetPlatform !== APP_PLATFORM) return false;
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
      } catch { /* network errors ignored */ }
    };

    // first check delayed 30s to avoid clashing with the startup check, then poll every 5 min
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
          {modal.title || (isBlocking ? t('versionGate.titleUpdate') : t('versionGate.titleMaintenance'))}
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
              {modal.url && <Button type="primary" onClick={handleAction}>{t('versionGate.downloadUpdate')}</Button>}
              <Button onClick={handleAction}>{t('versionGate.exitApp')}</Button>
            </Space>
          ) : (
            <Button type="primary" onClick={handleClose}>{t('versionGate.gotIt')}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}