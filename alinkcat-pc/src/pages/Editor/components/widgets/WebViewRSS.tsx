import { useCallback, useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  author?: string;
}

function RssItemCard({ item }: { item: RssItem }) {
  const handleClick = async () => {
    if (!item.link) return;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(item.link);
    } catch {
      window.open(item.link, '_blank', 'noopener');
    }
  };
  return (
    <div className="cw-rss-item" onClick={handleClick}>
      <div className="cw-rss-title">{item.title || '(无标题)'}</div>
      {item.pubDate && <div className="cw-rss-date">{item.pubDate}</div>}
      {item.description && <div className="cw-rss-desc">{item.description}</div>}
    </div>
  );
}

export default function WebViewRSS({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const url = (v.rssUrl as string) || '';
  const refresh = (v.refreshInterval as number) || 0;
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const data = await tauriInvoke<RssItem[]>('fetch_rss', { url });
      setItems(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    if (refresh > 0) {
      const id = setInterval(fetchData, refresh * 1000);
      return () => clearInterval(id);
    }
  }, [fetchData, refresh]);

  if (!url) {
    return (
      <div className="cw-webview-empty">
        <GlobalOutlined style={{ fontSize: 28, color: '#ccc' }} />
        <span>请输入 RSS 订阅地址</span>
        <span className="cw-webview-hint">在右侧属性面板中设置</span>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return <div className="cw-webview-loading"><Spin size="small" /></div>;
  }

  if (error) {
    return <div className="cw-webview-error">{error}</div>;
  }

  if (items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" style={{ padding: 20 }} />;
  }

  return (
    <div className="cw-rss-list">
      {items.map((item, i) => <RssItemCard key={i} item={item} />)}
    </div>
  );
}
