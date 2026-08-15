import { useCallback, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';

interface BilibiliLiveInfo {
  roomId: string;
  title: string;
  cover: string;
  liveStatus: number;
  online: number;
  anchorName: string;
  roomUrl: string;
}

export default function WebViewPresetBilibili({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const roomId = (v.bilibiliRoomId as string) || '';
  const refreshSec = (v.refreshInterval as number) || 30;
  const [info, setInfo] = useState<BilibiliLiveInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError('');
    try {
      const data = await tauriInvoke<BilibiliLiveInfo>('fetch_bilibili_room', { roomId });
      setInfo(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchData();
    if (refreshSec > 0) {
      const id = setInterval(fetchData, refreshSec * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refreshSec]);

  if (!roomId) {
    return (
      <div className="cw-webview-empty">
        <span style={{ fontSize: 28 }}>📺</span>
        <span>请输入 B站直播间 ID</span>
        <span className="cw-webview-hint">在右侧属性面板中设置</span>
      </div>
    );
  }

  if (loading && !info) {
    return <div className="cw-webview-loading"><Spin size="small" /></div>;
  }

  if (error) {
    return <div className="cw-webview-error">{error}</div>;
  }

  if (!info) {
    return <div className="cw-webview-empty">暂无数据</div>;
  }

  const isLive = info.liveStatus === 1;

  const handleOpen = async () => {
    if (!info.roomUrl) return;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(info.roomUrl);
    } catch {
      window.open(info.roomUrl, '_blank', 'noopener');
    }
  };

  return (
    <div className="cw-bili" onClick={handleOpen}>
      <div
        className="cw-bili-cover"
        style={{ backgroundImage: info.cover ? `url(${info.cover})` : undefined }}
      >
        <div className="cw-bili-cover-blur" />
        <div className="cw-bili-badge">
          <span className={`cw-bili-dot${isLive ? ' live' : ''}`} />
          <span>{isLive ? '直播中' : '未开播'}</span>
        </div>
      </div>
      <div className="cw-bili-body">
        <div className="cw-bili-title">{info.title || '(无标题)'}</div>
        {info.anchorName && <div className="cw-bili-anchor">主播：{info.anchorName}</div>}
        {isLive && <div className="cw-bili-online">👁 {info.online.toLocaleString()} 人观看</div>}
      </div>
    </div>
  );
}
