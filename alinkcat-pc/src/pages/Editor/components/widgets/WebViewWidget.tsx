import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const preset = (v.preset as string) || (widget.type === 'weather' ? 'weather' : 'none');

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
        <span>{t('common.widgets.webview.enterUrl')}</span>
        <span className="cw-webview-hint">{t('common.widgets.webview.enterUrlHint')}</span>
      </div>
    );
  }

  return (
    <iframe
      src={normalized}
      title={widget.label || t('common.widgets.webview.view')}
      className="cw-webview"
      style={{ pointerEvents: 'none' }}
      sandbox="allow-same-origin allow-scripts"
      scrolling={showScrollbar ? 'yes' : 'no'}
    />
  );
}