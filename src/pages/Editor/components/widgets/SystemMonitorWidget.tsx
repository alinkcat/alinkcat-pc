import { useEffect, useState } from 'react';
import type { EditorWidget } from '../../types';
import type { PerfSnapshot } from '../../types';
import { useTranslation } from 'react-i18next';
import { tauriInvoke } from '../../../../utils/tauri';

const BAR_COLORS: Record<string, string> = { cpu: '#4F6EF7', memory: '#52c41a', disk: '#faad14', net: '#13c2c2' };

function MetricRow({ label, pct, display, color }: { label: string; pct: number | null; display: string; color: string }) {
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="sm-row">
      <div className="sm-label">{label}</div>
      <div className="sm-bar"><div className="sm-fill" style={{ width: `${width}%`, background: color }} /></div>
      <div className="sm-val">{display}</div>
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
  const refreshInterval = Math.max(1, (v.refreshInterval as number) || 2);

  const [snap, setSnap] = useState<PerfSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const s = await tauriInvoke<PerfSnapshot>('get_current_snapshot');
        if (active) setSnap(s);
      } catch { /* 监控服务未运行，保留上次数据 */ }
    };
    poll();
    const id = setInterval(poll, refreshInterval * 1000);
    return () => { active = false; clearInterval(id); };
  }, [refreshInterval]);

  const cpu = snap?.cpu;
  const memory = snap?.memory;
  const disk = snap?.disk;
  const up = snap?.network?.upload;
  const down = snap?.network?.download;

  const fmtPct = (val: number | undefined): { pct: number | null; display: string } =>
    val === undefined ? { pct: null, display: '--' } : { pct: val, display: `${Math.round(val)}%` };
  const fmtNet = (val: number | undefined): string =>
    val === undefined ? '--' : (val / 1024).toFixed(1);

  return (
    <div className="cw-sm">
      <div className="sm-header">{t('common.widgets.monitor.title')}</div>
      {showCPU && (() => { const { pct, display } = fmtPct(cpu); return <MetricRow label={t('common.widgets.monitor.cpu')} pct={pct} display={display} color={BAR_COLORS.cpu} />; })()}
      {showMemory && (() => { const { pct, display } = fmtPct(memory); return <MetricRow label={t('common.widgets.monitor.memory')} pct={pct} display={display} color={BAR_COLORS.memory} />; })()}
      {showDisk && (() => { const { pct, display } = fmtPct(disk); return <MetricRow label={t('common.widgets.monitor.disk')} pct={pct} display={display} color={BAR_COLORS.disk} />; })()}
      {showNetwork && (
        <div className="sm-row">
          <div className="sm-label">{t('common.widgets.monitor.network')}</div>
          <div className="sm-net">
            <span className="sm-net-up">{t('common.widgets.monitor.upload', { val: fmtNet(up) })}</span>
            <span className="sm-net-down">{t('common.widgets.monitor.download', { val: fmtNet(down) })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
