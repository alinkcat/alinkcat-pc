import { useCallback, useEffect, useState } from 'react';
import { Spin, Empty } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { tauriInvoke } from '../../../../utils/tauri';
import type { EditorWidget } from '../../types';

function getField(item: Record<string, unknown>, field: string): unknown {
  if (!field) return undefined;
  if (field.includes('.')) {
    let cur: unknown = item;
    for (const seg of field.split('.')) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[seg];
      else return undefined;
    }
    return cur;
  }
  return item[field];
}

function renderValue(data: unknown, cfg: {
  titleField: string; descField: string; timeField: string; linkField: string;
}): React.ReactNode {
  if (Array.isArray(data)) {
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无数据" style={{ padding: 20 }} />;

    const first = data[0];
    if (first && typeof first === 'object') {
      // 对象数组 → 卡片列表（使用字段映射）
      return (
        <div className="cw-json-list">
          {data.map((raw, i) => {
            const item = raw as Record<string, unknown>;
            const title = String(getField(item, cfg.titleField) ?? `条目 ${i + 1}`);
            const desc = getField(item, cfg.descField) ? String(getField(item, cfg.descField)) : '';
            const time = getField(item, cfg.timeField) ? String(getField(item, cfg.timeField)) : '';
            const link = getField(item, cfg.linkField) ? String(getField(item, cfg.linkField)) : '';
            return (
              <div
                key={i}
                className="cw-json-item"
                onClick={() => { if (link) window.open(link, '_blank', 'noopener'); }}
              >
                <div className="cw-json-title">{title}</div>
                {time && <div className="cw-json-date">{time}</div>}
                {desc && <div className="cw-json-desc">{desc}</div>}
              </div>
            );
          })}
        </div>
      );
    }
    // 原始数组 → 简单列表
    return (
      <div className="cw-json-list">
        {data.map((val, i) => (
          <div key={i} className="cw-json-item">{String(val)}</div>
        ))}
      </div>
    );
  }

  if (data && typeof data === 'object') {
    // 对象 → 键值对
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div className="cw-json-kv">
        {entries.map(([k, val]) => (
          <div key={k} className="cw-json-kv-row">
            <span className="cw-json-kv-key">{k}</span>
            <span className="cw-json-kv-val">
              {val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <div className="cw-json-kv"><div className="cw-json-kv-row"><span>{String(data)}</span></div></div>;
}

export default function WebViewJSON({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const url = (v.jsonUrl as string) || '';
  const titleField = (v.titleField as string) || 'title';
  const descField = (v.descField as string) || 'description';
  const timeField = (v.timeField as string) || 'pubDate';
  const linkField = (v.linkField as string) || 'link';
  const refresh = (v.refreshInterval as number) || 0;
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const json = await tauriInvoke<unknown>('fetch_json', { url });
      setData(json);
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
        <span>请输入 JSON API 地址</span>
        <span className="cw-webview-hint">在右侧属性面板中设置</span>
      </div>
    );
  }

  if (loading && data === null) {
    return <div className="cw-webview-loading"><Spin size="small" /></div>;
  }

  if (error) {
    return <div className="cw-webview-error">{error}</div>;
  }

  return (
    <div className="cw-json-wrap">
      {renderValue(data, { titleField, descField, timeField, linkField })}
    </div>
  );
}
