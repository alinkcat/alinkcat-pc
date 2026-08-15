import type { EditorWidget } from '../../types';
import ButtonWidget from './ButtonWidget';
import GaugeWidget from './GaugeWidget';
import StickyNoteWidget from './StickyNoteWidget';
import ImageWidget from './ImageWidget';
import TextWidget from './TextWidget';
import ShapeWidget from './ShapeWidget';
import WebViewWidget from './WebViewWidget';
import MediaWidget from './MediaWidget';
import SystemMonitorWidget from './SystemMonitorWidget';
import QuickActionWidget from './QuickActionWidget';
import LauncherWidget from './LauncherWidget';
import ClockWidget from './ClockWidget';
import DateWidget from './DateWidget';
import CalendarWidget from './CalendarWidget';

function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith('#') && hex.length >= 7) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  return [240, 242, 245];
}

function renderContent(widget: EditorWidget) {
  switch (widget.type) {
    case 'button': return <ButtonWidget widget={widget} />;
    case 'gauge': return <GaugeWidget widget={widget} />;
    case 'snippet-list': return <StickyNoteWidget widget={widget} />;
    case 'image': return <ImageWidget widget={widget} />;
    case 'text': return <TextWidget widget={widget} />;
    case 'shape': return <ShapeWidget widget={widget} />;
    case 'webview': return <WebViewWidget widget={widget} />;
    case 'media-control': return <MediaWidget widget={widget} />;
    case 'system-monitor': return <SystemMonitorWidget widget={widget} />;
    case 'quick-action': return <QuickActionWidget widget={widget} />;
    case 'launcher': return <LauncherWidget widget={widget} />;
    case 'clock': return <ClockWidget widget={widget} />;
    case 'date': return <DateWidget widget={widget} />;
    case 'calendar': return <CalendarWidget widget={widget} />;
    default: return <div className="cw-unknown">{widget.label || '?'}</div>;
  }
}

export default function WidgetRenderer({ widget }: { widget: EditorWidget }) {
  const bg = widget.backgroundColor || '#f0f2f5';
  const opacity = (widget.backgroundOpacity ?? 100) / 100;
  const [r, g, b] = hexToRgb(bg);

  return (
    <>
      <div className="cw-bg" style={{ backgroundColor: `rgba(${r},${g},${b},${opacity})` }} />
      <div className="cw-inner" style={{
        color: widget.textColor || '#333',
        fontSize: `${widget.fontSize || 12}px`,
        fontWeight: widget.fontWeight || 'normal',
      }}>
        {renderContent(widget)}
      </div>
    </>
  );
}