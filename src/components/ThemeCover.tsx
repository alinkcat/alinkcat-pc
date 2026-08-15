import { useEffect, useState } from 'react';
import { Skeleton } from 'antd';
import { getColorFromId, getInitials, resolveImage } from '../utils/coverHelper';

interface ThemeCoverProps {
  themeId: string;
  themeName: string;
  /** 第一个页面的背景图引用（优先使用） */
  coverUrl?: string;
  /** 是否存在 cover.png */
  hasCover?: boolean;
}

type CoverState = 'loading' | 'ready' | 'placeholder';

/**
 * 主题包封面图，三级降级：
 * 1. 第一个页面背景图
 * 2. cover.png
 * 3. 按 ID 生成颜色的首字母占位图
 */
export default function ThemeCover({ themeId, themeName, coverUrl, hasCover }: ThemeCoverProps) {
  const [state, setState] = useState<CoverState>('loading');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSrc(null);

    (async () => {
      // Level 1: page background
      const bg = await resolveImage(themeId, coverUrl);
      if (cancelled) return;
      if (bg) { setSrc(bg); setState('ready'); return; }

      // Level 2: cover.png
      if (hasCover) {
        const cover = await resolveImage(themeId, 'cover.png');
        if (cancelled) return;
        if (cover) { setSrc(cover); setState('ready'); return; }
      }

      // Level 3: placeholder
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
