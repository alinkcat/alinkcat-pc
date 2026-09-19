import { useMemo } from 'react';
import type { EditorWidget } from '../../types';
import { useDataSubscription } from '../../hooks/useDataSubscription';
import { useTranslation } from 'react-i18next';

/** data source → i18n key（common namespace widgets.monitor.*） */
const SOURCE_LABEL_KEYS: Record<string, string> = {
  'system.cpu.usage': 'monitor.cpu',
  'system.memory.usage': 'monitor.memory',
  'system.disk.usage': 'monitor.disk',
  'system.network.upload': 'monitor.upload',
  'system.network.download': 'monitor.download',
  'system.uptime': 'monitor.runtime',
};

function formatValue(ds: string, val: number | null): string {
  if (val === null) return '--';
  if (ds === 'system.uptime') { const h = Math.floor(val / 3600), m = Math.floor((val % 3600) / 60); return h > 0 ? `${h}h${m}m` : `${m}m`; }
  if (ds.startsWith('system.network')) return val.toFixed(1);
  return String(Math.round(val));
}

function formatUnit(ds: string): string {
  if (ds === 'system.uptime') return '';
  if (ds.startsWith('system.network')) return 'KB/s';
  return '%';
}

export default function GaugeWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const dataSource = (v.dataSource as string) || 'system.cpu.usage';
  const gaugeStyle = (v.gaugeStyle as string) || 'ring';
  const unit = (v.unit as string) || formatUnit(dataSource);
  const rawValue = useDataSubscription(dataSource);
  const minValue = (v.minValue as number) ?? 0;
  const maxValue = (v.maxValue as number) ?? 100;
  const ringColorLow = (v.ringColorLow as string) || '#52c41a';
  const ringColorMid = (v.ringColorMid as string) || '#faad14';
  const ringColorHigh = (v.ringColorHigh as string) || '#ff4d4f';
  const ringWidth = Math.max(4, Math.min(20, (v.ringWidth as number) || 6));

  const pct = useMemo(() => {
    if (rawValue === null) return 0;
    if (dataSource.startsWith('system.network')) return Math.min(100, rawValue / 10);
    const range = maxValue - minValue || 1;
    return Math.min(100, Math.max(0, ((rawValue - minValue) / range) * 100));
  }, [rawValue, dataSource, minValue, maxValue]);

  const ringColor = pct < 33 ? ringColorLow : pct < 66 ? ringColorMid : ringColorHigh;
  const display = formatValue(dataSource, rawValue);
  const labelKey = SOURCE_LABEL_KEYS[dataSource];
  const label = labelKey ? t(`common.widgets.${labelKey}`) : (widget.label || t('common.widgets.gauge'));

  if (gaugeStyle === 'number') {
    return (
      <div className="cw-gauge-num">
        <span className="cw-gauge-big">{display}</span>
        <span className="cw-gauge-unit">{unit}</span>
        <span className="cw-label">{label}</span>
      </div>
    );
  }

  if (gaugeStyle === 'bar') {
    return (
      <div className="cw-gauge-bar-wrap">
        <div className="cw-gauge-bar-label">{label}</div>
        <div className="cw-gauge-bar-track">
          <div className="cw-gauge-bar-fill" style={{ width: `${pct}%`, background: ringColor, transition: 'width 0.6s ease' }} />
        </div>
        <div className="cw-gauge-bar-val">{display} {unit}</div>
      </div>
    );
  }

  const R = 50;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);

  return (
    <div className="cw-gauge">
      <svg viewBox="0 0 120 120" className="cw-gauge-svg" style={{ overflow: 'visible' }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e8e8e8" strokeWidth={ringWidth} />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={ringColor} strokeWidth={ringWidth}
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" dominantBaseline="central"
          fontSize="20" fontWeight="700" fill={widget.textColor || '#333'}>
          {display}
        </text>
        {unit && (
          <text x="60" y="78" textAnchor="middle" fontSize="10" fill="#999">
            {unit}
          </text>
        )}
      </svg>
      <span className="cw-label">{label}</span>
    </div>
  );
}