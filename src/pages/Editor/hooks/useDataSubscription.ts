import { useState, useEffect, useRef } from 'react';
import { tauriInvoke } from '../../../utils/tauri';
import type { PerfSnapshot } from '../types';

const SOURCE_MAP: Record<string, (s: PerfSnapshot) => number | undefined> = {
  'system.cpu.usage': s => s.cpu,
  'system.memory.usage': s => s.memory,
  'system.disk.usage': s => s.disk,
  'system.network.upload': s => s.network?.upload,
  'system.network.download': s => s.network?.download,
  'system.uptime': s => s.uptime,
  'system.battery.level': s => s.battery?.level,
};

export function useDataSubscription(dataSource: string | undefined): number | null {
  const [value, setValue] = useState<number | null>(null);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dataSource) return;
    let active = true;
    const extractor = SOURCE_MAP[dataSource];
    if (!extractor) return;

    const poll = async () => {
      try {
        const snap = await tauriInvoke<PerfSnapshot>('get_current_snapshot');
        if (!active) return;
        const v = extractor(snap);
        if (v !== undefined) {
          prevRef.current = v;
          setValue(v);
        }
      } catch { /* monitor not running */ }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => { active = false; clearInterval(id); };
  }, [dataSource]);

  return value;
}
