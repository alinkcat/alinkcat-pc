import type { EditorWidget } from '../../types';

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
  const v = widget as Record<string, unknown>;
  const showCPU = (v.showCPU as boolean) ?? true;
  const showMemory = (v.showMemory as boolean) ?? true;
  const showDisk = (v.showDisk as boolean) ?? true;
  const showNetwork = (v.showNetwork as boolean) ?? true;

  return (
    <div className="cw-sm">
      <div className="sm-header">系统监控</div>
      {showCPU && <MetricRow label="CPU" pct={75} color={BAR_COLORS.cpu} />}
      {showMemory && <MetricRow label="内存" pct={68} color={BAR_COLORS.memory} />}
      {showDisk && <MetricRow label="磁盘" pct={45} color={BAR_COLORS.disk} />}
      {showNetwork && (
        <div className="sm-row">
          <div className="sm-label">网络</div>
          <div className="sm-net">
            <span className="sm-net-up">↑ 12.3 KB/s</span>
            <span className="sm-net-down">↓ 45.6 KB/s</span>
          </div>
        </div>
      )}
    </div>
  );
}