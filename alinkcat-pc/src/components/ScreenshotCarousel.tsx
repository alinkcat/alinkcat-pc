import { useEffect, useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { resolveImageUrl } from '../utils/resolveImageUrl';

interface ScreenshotCarouselProps {
  images: string[];
  alt?: string;
  height?: number;
}

/** 轻量截图轮播图：自动播放 + 左右箭头 + 指示点，无第三方依赖（antd v6 已移除 Carousel）。 */
export default function ScreenshotCarousel({ images, alt = '', height = 280 }: ScreenshotCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  const go = (i: number) => setIndex(((i % count) + count) % count);

  // 自动轮播（5s）
  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(timer);
  }, [count]);

  if (count === 0) return null;

  return (
    <div style={{ position: 'relative', height, borderRadius: 8, overflow: 'hidden' }}>
      {/* 滑动轨道 */}
      <div style={{
        display: 'flex', width: '100%', height: '100%',
        transform: `translateX(-${index * 100}%)`,
        transition: 'transform .4s ease',
      }}>
        {images.map((src, i) => (
          <img
            key={i}
            src={resolveImageUrl(src)}
            alt={`${alt} ${i + 1}`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          {/* 左右箭头 */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 8, display: 'flex', alignItems: 'center' }}>
            <button
              aria-label="previous"
              onClick={() => go(index - 1)}
              style={{ ...arrowBtnStyle, }}
            >
              <LeftOutlined />
            </button>
          </div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 8, display: 'flex', alignItems: 'center' }}>
            <button
              aria-label="next"
              onClick={() => go(index + 1)}
              style={{ ...arrowBtnStyle }}
            >
              <RightOutlined />
            </button>
          </div>
          {/* 指示点 */}
          <div style={{
            position: 'absolute', bottom: 8, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 6,
          }}>
            {images.map((_, i) => (
              <span
                key={i}
                onClick={() => go(i)}
                style={{
                  width: i === index ? 16 : 6,
                  height: 6, borderRadius: 3, cursor: 'pointer',
                  background: i === index ? '#4F6EF7' : 'rgba(255,255,255,0.6)',
                  transition: 'width .2s',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const arrowBtnStyle: React.CSSProperties = {
  width: 28, height: 28, border: 'none', borderRadius: '50%',
  background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', opacity: 0.7,
};
