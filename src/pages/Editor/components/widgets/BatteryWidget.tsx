import { useMemo } from 'react';
import type { EditorWidget } from '../../types';
import { useDataSubscription } from '../../hooks/useDataSubscription';

export default function BatteryWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const batteryStyle = (v.batteryStyle as string) || 'bar';
  const showLevel = (v.showLevel as boolean) ?? true;
  const showCharging = (v.showCharging as boolean) ?? true;
  const showTemp = (v.showTemp as boolean) ?? false;
  const barColor = (v.barColor as string) || '#52c41a';
  const lowColor = (v.lowColor as string) || '#ff4d4f';
  const lowThreshold = (v.lowThreshold as number) ?? 20;
  const dataSource = (v.dataSource as string) || 'system.battery.level';

  const rawValue = useDataSubscription(dataSource);

  const level = useMemo(() => {
    if (rawValue === null) {
      // editor preview mode：use mock data
      return 75;
    }
    return Math.min(100, Math.max(0, Math.round(rawValue)));
  }, [rawValue]);

  const isLow = level <= lowThreshold;
  const color = isLow ? lowColor : barColor;
  const display = rawValue === null ? `${level}` : `${level}`;
  const isCharging = false; // mock data，PC does not push charging state yet

  const textColor = widget.textColor || '#333';

  if (batteryStyle === 'number') {
    return (
      <div className="cw-battery cw-battery-num" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: '2em', fontWeight: 700, color, lineHeight: 1.2 }}>
          {display}
          <span style={{ fontSize: '0.5em', fontWeight: 400, color: textColor, marginLeft: 2 }}>%</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          {showCharging && <span style={{ fontSize: 16 }}>{isCharging ? '⚡' : '🔋'}</span>}
          {showTemp && <span style={{ fontSize: 11, color: textColor, opacity: 0.6 }}>25°C</span>}
        </div>
      </div>
    );
  }

  if (batteryStyle === 'ring') {
    const R = 45;
    const C = 2 * Math.PI * R;
    const offset = C * (1 - level / 100);

    return (
      <div className="cw-battery cw-battery-ring" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <svg viewBox="0 0 100 100" style={{ width: '80%', maxWidth: 120, overflow: 'visible' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#e8e8e8" strokeWidth={8} />
          <circle
            cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {showLevel && (
            <text x="50" y="48" textAnchor="middle" dominantBaseline="central"
              fontSize="18" fontWeight="700" fill={color}>
              {display}%
            </text>
          )}
        </svg>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          {showCharging && <span style={{ fontSize: 14 }}>{isCharging ? '⚡' : '🔋'}</span>}
          {showTemp && <span style={{ fontSize: 10, color: textColor, opacity: 0.6 }}>25°C</span>}
        </div>
      </div>
    );
  }

  // bar style - horizontal battery bar
  return (
    <div className="cw-battery cw-battery-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {showCharging && <span style={{ fontSize: 16 }}>{isCharging ? '⚡' : '🔋'}</span>}
        {showLevel && (
          <span style={{ fontSize: 13, fontWeight: 600, color, lineHeight: 1 }}>
            {display}%
          </span>
        )}
        {showTemp && <span style={{ fontSize: 10, color: textColor, opacity: 0.6 }}>25°C</span>}
      </div>
      <div style={{
        position: 'relative',
        width: '100%',
        height: 20,
        border: `2px solid ${color}`,
        borderRadius: 4,
        background: 'transparent',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${level}%`,
          height: '100%',
          background: color,
          transition: 'width 0.5s ease',
          borderRadius: level === 100 ? 2 : 0,
        }} />
        {/* battery tip */}
        <div style={{
          position: 'absolute',
          right: -6,
          top: 4,
          width: 4,
          height: 8,
          background: color,
          borderRadius: '0 2px 2px 0',
        }} />
      </div>
    </div>
  );
}