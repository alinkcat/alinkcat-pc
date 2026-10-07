import { useEffect, useState } from 'react';
import { Skeleton } from 'antd';
import { getColorFromId, getInitials, resolveImage } from '../utils/coverHelper';

interface ThemeCoverProps {
  themeId: string;
  themeName: string;
  /** background image ref from the first page (preferred) */
  coverUrl?: string;
  /** whether cover.png exists */
  hasCover?: boolean;
}

type CoverState = 'loading' | 'ready' | 'placeholder';

/** theme pack cover with 3-level fallback: first page background → cover.png → initials placeholder colored by id */
export default function ThemeCover({ themeId, themeName, coverUrl, hasCover }: ThemeCoverProps) {
  const [state, setState] = useState<CoverState>('loading');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSrc(null);

    (async () => {
      const bg = await resolveImage(themeId, coverUrl);
      if (cancelled) return;
      if (bg) { setSrc(bg); setState('ready'); return; }

      if (hasCover) {
        const cover = await resolveImage(themeId, 'cover.png');
        if (cancelled) return;
        if (cover) { setSrc(cover); setState('ready'); return; }
      }

      if (!cancelled) setState('placeholder');
    })();

    return () => { cancelled = true; };
  }, [themeId, coverUrl, hasCover]);

  if (state === 'loading') {
    return <Skeleton.Image active style={{ width: '100%', height: 140 }} />;
  }

  if (state === 'ready' && src) {
    return (
      <img
        src={src}
        alt={themeName}
        className="theme-cover-img"
        onError={() => setState('placeholder')}
      />
    );
  }

  const bg = getColorFromId(themeId);
  return (
    <div className="theme-cover-fallback" style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }}>
      <span className="theme-cover-letter" style={{ color: '#fff' }}>{getInitials(themeName)}</span>
      <span className="theme-cover-hint" style={{ color: 'rgba(255,255,255,0.9)' }}>{themeName}</span>
    </div>
  );
}
