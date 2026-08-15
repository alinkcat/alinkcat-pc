import { useEffect, useState } from 'react';
import type { EditorWidget } from '../../types';

export default function ClockWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const format24h = (v.format24h as boolean) ?? true;
  const showSeconds = (v.showSeconds as boolean) ?? true;
  const showAmpm = (v.showAmpm as boolean) ?? true;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), showSeconds ? 250 : 1000);
    return () => clearInterval(id);
  }, [showSeconds]);

  let h = now.getHours();
  let ap = '';
  if (!format24h) {
    ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  const hh = String(h).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const time = showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;

  return (
    <div
      className="cw-clock"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: '2em',
          fontWeight: 600,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 1,
        }}
      >
        {time}
      </div>
      {!format24h && showAmpm && (
        <div style={{ fontSize: '0.85em', opacity: 0.7 }}>{ap}</div>
      )}
    </div>
  );
}
