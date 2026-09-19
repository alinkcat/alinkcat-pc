import { useCallback, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

interface BiliRoom {
  title: string;
  liveStatus: number;
  online?: number;
  userCover?: string;
  anchor?: string;
}

function normalizeRoomId(raw: string): string {
  const id = raw.trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return id;
  const m = id.match(/\/\/(?:www\.)?bilibili\.com\/\d+\/(\d+)/);
  return m ? m[1] : id;
}

export default function WebViewPresetBilibili({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const roomId = (v.roomId as string) || '';
  const refresh = (v.refreshInterval as number) || 0;
  const [room, setRoom] = useState<BiliRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    const id = normalizeRoomId(roomId);
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await tauriInvoke<{ data: { room_info?: BiliRoom } }>('fetch_bilibili_room', { roomId: id });
      const info = res?.data?.room_info;
      if (info) {
        setRoom(info);
      } else {
        setError(t('noData'));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [roomId, t]);

  useEffect(() => {
    fetchData();
    if (refresh > 0) {
      const id = setInterval(fetchData, refresh * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refresh]);

  if (!roomId) {
    return (
      <div className="cw-webview-empty">
        <GlobalOutlined style={{ fontSize: 28, color: '#ccc' }} />
        <span>{t('common.widgets.webview.enterBilibiliId')}</span>
        <span className="cw-webview-hint">{t('common.widgets.webview.panelHint')}</span>
      </div>
    );
  }

  if (loading && !room) return <div className="cw-webview-loading"><Spin size="small" /></div>;
  if (error) return <div className="cw-webview-error">{error}</div>;
  if (!room) return <div className="cw-webview-empty">{t('noData')}</div>;

  const live = room.liveStatus === 1;

  return (
    <div className="cw-bili">
      <div className="cw-bili-cover" style={room.userCover ? { backgroundImage: `url(${room.userCover})` } : undefined} />
      <div className="cw-bili-main">
        <div className="cw-bili-title">{room.title || t('common.widgets.noTitle')}</div>
        <div className="cw-bili-meta">
          <span className={`cw-bili-status ${live ? 'live' : ''}`}>
            {live ? t('common.widgets.live') : t('common.widgets.offline')}
          </span>
          {room.anchor && <span className="cw-bili-anchor">{t('common.widgets.anchor', { name: room.anchor })}</span>}
          {live && room.online !== undefined && (
            <span className="cw-bili-viewers">{t('common.widgets.viewers', { count: room.online })}</span>
          )}
        </div>
      </div>
    </div>
  );
}