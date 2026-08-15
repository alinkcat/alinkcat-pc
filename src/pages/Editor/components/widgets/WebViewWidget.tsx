import { GlobalOutlined } from '@ant-design/icons';
import type { EditorWidget } from '../../types';
import WebViewRSS from './WebViewRSS';
import WebViewJSON from './WebViewJSON';
import WebViewPresetBilibili from './WebViewPresetBilibili';
import WebViewPresetWeather from './WebViewPresetWeather';

function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^file:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default function WebViewWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const preset = (v.preset as string) || 'none';

  if (preset === 'bilibili') {
    return <WebViewPresetBilibili widget={widget} />;
  }

  if (preset === 'weather') {
    return <WebViewPresetWeather widget={widget} />;
  }

  // non-preset modes
  const displayMode = (v.displayMode as string) || 'webpage';

  if (displayMode === 'rss') {
    return <WebViewRSS widget={widget} />;
  }

  if (displayMode === 'json') {
    return <WebViewJSON widget={widget} />;
  }

  // webpage mode
  const url = (v.url as string) || '';
  const showScrollbar = (v.showScrollbar as boolean) ?? true;
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return (
      <div className="cw-webview-empty">
        <GlobalOutlined style={{ fontSize: 28, color: '#ccc' }} />
        <span>请输入网址</span>
        <span className="cw-webview-hint">在右侧属性面板输入要加载的网页地址</span>
      </div>
    );
  }

  return (
    <iframe
      src={normalized}
      title={widget.label || '网页视图'}
      className="cw-webview"
      style={{ pointerEvents: 'none' }}
      sandbox="allow-same-origin allow-scripts"
      scrolling={showScrollbar ? 'yes' : 'no'}
    />
  );
}
