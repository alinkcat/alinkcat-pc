import type { ReactNode } from 'react';

export default function PhoneFrame({ width, height, orientation, children }: {
  width: number; height: number; orientation: string; children: ReactNode;
}) {
  return (
    <div className="phone-wrapper">
      <div className={`phone-frame${orientation === 'landscape' ? ' landscape' : ''}`}
        style={{ width, height }}>
        <div className="phone-notch" />
        <div className="phone-statusbar"><span>9:41</span><span>●●● ▲ ■</span></div>
        {children}
      </div>
    </div>
  );
}
