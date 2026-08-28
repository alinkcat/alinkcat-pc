import type { EditorWidget } from '../../types';
import { useTranslation } from 'react-i18next';

const BAR_COLORS: Record<string, string> = { cpu: '#4F6EF7', memory: '#52c41a', disk: '#faad14', net: '#13c2c2' };

function MetricRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="sm-row">
      <div className="sm-label">{label}</div>
      <div className="sm-bar"><div className="sm-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="sm-val">{pct}%</div>
    </div>
  );
}

export default function SystemMonitorWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const showCPU = (v.showCPU as boolean) ?? true;
  const showMemory = (v.showMemory as boolean) ?? true;
  const showDisk = (v.showDisk as boolean) ?? true;
  const showNetwork = (v.showNetwork as boolean) ?? true;

  return (
    <div className="cw-sm">
      <div className="sm-header">{t('common.widgets.monitor.title')}</div>
      {showCPU && <MetricRow label={t('common.widgets.monitor.cpu')} pct={75} color={BAR_COLORS.cpu} />}
      {showMemory && <MetricRow label={t('common.widgets.monitor.memory')} pct={68} color={BAR_COLORS.memory} />}
      {showDisk && <MetricRow label={t('common.widgets.monitor.disk')} pct={45} color={BAR_COLORS.disk} />}
      {showNetwork && (
        <div className="sm-row">
          <div className="sm-label">{t('common.widgets.monitor.network')}</div>
          <div className="sm-net">
            <span className="sm-net-up">{t('common.widgets.monitor.upload', { val: '12.3' })}</span>
            <span className="sm-net-down">{t('common.widgets.monitor.download', { val: '45.6' })}</span>
          </div>
        </div>
      )}
    </div>
  );
}