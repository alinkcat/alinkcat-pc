import { useEffect, useRef, useState } from 'react';
import type { EditorWidget } from '../../types';

export default function ClockWidget({ widget }: { widget: EditorWidget }) {
  const v = widget as Record<string, unknown>;
  const format24h = (v.format24h as boolean) ?? true;
  const showSeconds = (v.showSeconds as boolean) ?? true;
  const showAmpm = (v.showAmpm as boolean) ?? true;

  const clockDisplay = (v.clockDisplay as string) ?? 'digital';

  // Analog clock props
  const tickMarks = (v.tickMarks as boolean) ?? true;
  const showNumbers = (v.showNumbers as boolean) ?? true;
  const handStyle = (v.handStyle as string) ?? 'classic';
  const faceColor = (v.faceColor as string) ?? '#ffffff';
  const handColor = (v.handColor as string) ?? '#333333';

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), showSeconds ? 250 : 1000);
    return () => clearInterval(id);
  }, [showSeconds]);

  // ─── Digital clock rendering (existing) ──────────────────────
  if (clockDisplay === 'digital') {
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

  // ─── Analog clock rendering ──────────────────────────────────
  return <AnalogClockCanvas
    now={now}
    tickMarks={tickMarks}
    showNumbers={showNumbers}
    handStyle={handStyle}
    faceColor={faceColor}
    handColor={handColor}
  />;
}

function AnalogClockCanvas({
  now,
  tickMarks,
  showNumbers,
  handStyle,
  faceColor,
  handColor,
}: {
  now: Date;
  tickMarks: boolean;
  showNumbers: boolean;
  handStyle: string;
  faceColor: string;
  handColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const s = Math.min(width, height);
        sizeRef.current = s;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = s * dpr;
        canvas.height = s * dpr;
        canvas.style.width = `${s}px`;
        canvas.style.height = `${s}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Pre-compute hand thickness based on handStyle
  const getHandThickness = (base: number) => {
    switch (handStyle) {
      case 'modern': return base * 1.5;
      case 'thin': return base * 0.5;
      default: return base;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = sizeRef.current;
    if (s <= 0) return;

    const cx = s / 2;
    const cy = s / 2;
    const radius = s / 2 - 4; // small padding

    // Clear
    ctx.clearRect(0, 0, s, s);

    // ── Face circle ──
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = faceColor;
    ctx.fill();
    ctx.strokeStyle = handColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Tick marks (12 hour marks) ──
    if (tickMarks) {
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const inner = radius * 0.85;
        const outer = radius * 0.93;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.strokeStyle = handColor;
        ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.5;
        ctx.stroke();
      }
    }

    // ── Numbers (12, 3, 6, 9) ──
    if (showNumbers) {
      ctx.fillStyle = handColor;
      ctx.font = `bold ${radius * 0.16}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numRadius = radius * 0.75;
      const numbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const nx = cx + Math.cos(angle) * numRadius;
        const ny = cy + Math.sin(angle) * numRadius;
        ctx.fillText(String(numbers[i]), nx, ny);
      }
    }

    // ── Compute hand angles ──
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const millis = now.getMilliseconds();

    const secondAngle = (seconds + millis / 1000) * 6 - 90;
    const minuteAngle = (minutes + seconds / 60) * 6 - 90;
    const hourAngle = (hours + minutes / 60) * 30 - 90;

    const toRad = (deg: number) => deg * (Math.PI / 180);

    // ── Hour hand ──
    const hhLen = radius * 0.5;
    const hhThick = getHandThickness(4);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(toRad(hourAngle)) * hhLen, cy + Math.sin(toRad(hourAngle)) * hhLen);
    ctx.strokeStyle = handColor;
    ctx.lineWidth = hhThick;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Minute hand ──
    const mhLen = radius * 0.7;
    const mhThick = getHandThickness(3);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(toRad(minuteAngle)) * mhLen, cy + Math.sin(toRad(minuteAngle)) * mhLen);
    ctx.strokeStyle = handColor;
    ctx.lineWidth = mhThick;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Second hand ──
    const shLen = radius * 0.8;
    const shThick = getHandThickness(1.5);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(toRad(secondAngle)) * shLen, cy + Math.sin(toRad(secondAngle)) * shLen);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = shThick;
    ctx.lineCap = 'round';
    ctx.stroke();

    // ── Center dot ──
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = handColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444';
    ctx.fill();
  }, [now, tickMarks, showNumbers, handStyle, faceColor, handColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}