import { useEffect, useState } from 'react';
import type { EditorWidget } from '../../types';
import { fetchLunar, fmtDate } from './lunarUtils';
import { useTranslation } from 'react-i18next';

export default function DateWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const v = widget as Record<string, unknown>;
  const dateFormat = (v.dateFormat as string) || 'YYYY年MM月DD日 星期X';
  const showLunar = (v.showLunar as boolean) ?? true;
  const weekdays = (t('common.widgets.weekdays', { returnObjects: true }) as string[]) || [];

  const [now, setNow] = useState(() => new Date());
  const [lunar, setLunar] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showLunar) {
      setLunar('');
      return;
    }
    let cancelled = false;
    fetchLunar(now).then((info) => {
      if (!cancelled && info) setLunar(t('common.widgets.lunar', { month: info.lunarMonth, day: info.lunarDay }));
    });
    return () => {
      cancelled = true;
    };
  }, [now, showLunar, t]);

  return (
    <div
      className="cw-date"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{fmtDate(now, dateFormat, weekdays)}</div>
      {showLunar && lunar && (
        <div style={{ fontSize: '0.85em', opacity: 0.75, marginTop: 4 }}>{lunar}</div>
      )}
    </div>
  );
}