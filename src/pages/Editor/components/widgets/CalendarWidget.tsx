import { useEffect, useMemo, useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { EditorWidget } from '../../types';
import { fetchLunar, toDateStr } from './lunarUtils';
import { useTranslation } from 'react-i18next';

export default function CalendarWidget({ widget }: { widget: EditorWidget }) {
  const { t } = useTranslation();
  const weekdaysAbbr = (t('common.widgets.weekdaysAbbr', { returnObjects: true }) as string[]) || [];
  const v = widget as Record<string, unknown>;
  const viewMode = (v.viewMode as string) || 'month';
  const highlightToday = (v.highlightToday as boolean) ?? true;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date | null>(null);
  const [lunar, setLunar] = useState('');

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const base = today.getDay();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - base);
    const list: Date[] = [];
    for (let i = 0; i < 7; i++) {
      list.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    }
    return list;
  }, [today]);

  const isToday = (d: Date) => d.getTime() === today.getTime();
  const isSelected = (d: Date) => selected !== null && d.getTime() === selected.getTime();

  const prev = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const pick = (d: Date) => setSelected(d);

  useEffect(() => {
    if (!selected) {
      setLunar('');
      return;
    }
    let cancelled = false;
    fetchLunar(selected).then((info) => {
      if (!cancelled) setLunar(info ? t('common.widgets.lunar', { month: info.lunarMonth, day: info.lunarDay }) : '');
    });
    return () => {
      cancelled = true;
    };
  }, [selected, t]);

  const cellStyle = (d: Date): React.CSSProperties => {
    const todayCell = highlightToday && isToday(d);
    return {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      cursor: 'pointer',
      borderRadius: 4,
      fontWeight: todayCell ? 700 : 400,
      color: todayCell ? '#fff' : undefined,
      background: todayCell ? '#4F6EF7' : isSelected(d) ? 'rgba(79,110,247,0.18)' : undefined,
      outline: isSelected(d) && !todayCell ? '1px solid #4F6EF7' : undefined,
    };
  };

  return (
    <div className="cw-calendar" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <span style={{ cursor: 'pointer' }} onClick={prev}><LeftOutlined style={{ fontSize: 10 }} /></span>
        <span>
          {viewMode === 'month'
            ? t('common.widgets.calendar.monthTitle', { year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
            : t('common.widgets.calendar.monthTitle', { year: today.getFullYear(), month: today.getMonth() + 1 })}
        </span>
        <span style={{ cursor: 'pointer' }} onClick={next}><RightOutlined style={{ fontSize: 10 }} /></span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: 2,
          fontSize: 10,
          color: 'rgba(0,0,0,0.55)',
        }}
      >
        {weekdaysAbbr.map((w: string) => (
          <div key={w} style={{ textAlign: 'center' }}>{w}</div>
        ))}
      </div>

      {viewMode === 'month' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: 2 }}>
          {monthDays.map((d, i) => (
            <div key={i} style={{ minHeight: 18 }}>
              {d && <div style={cellStyle(d)} onClick={() => pick(d)}>{d.getDate()}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1, gap: 2 }}>
          {weekDays.map((d) => (
            <div key={d.getTime()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.55)' }}>{weekdaysAbbr[d.getDay()]}</span>
              <div style={cellStyle(d)} onClick={() => pick(d)}>{d.getDate()}</div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 4,
          paddingTop: 4,
          borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 10,
          color: 'rgba(0,0,0,0.65)',
          minHeight: 16,
          textAlign: 'center',
        }}
      >
        {selected
          ? `${toDateStr(selected)}${lunar ? ` · ${lunar}` : ''}`
          : t('common.widgets.clickForLunar')}
      </div>
    </div>
  );
}