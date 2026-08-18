import { useEffect, useRef } from 'react';
import splashData from '../assets/splash-lottie.json';

/**
 * 启动页：显示 Lottie 品牌动画（lottie-web 通过 index.html 的 script 标签加载）。
 * 动画播完后调用 onFinished。
 */
export default function SplashScreen({ onFinished, minDelay = 2200 }: {
  onFinished: () => void;
  minDelay?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<ReturnType<typeof window.lottie.loadAnimation> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const anim = window.lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: splashData,
    });
    animRef.current = anim;

    const started = Date.now();

    const finish = () => {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, minDelay - elapsed);
      setTimeout(onFinished, wait);
    };

    // 动画播完触发；同时设置兜底超时（如动画异常）
    anim.addEventListener('complete', finish);
    const fallback = setTimeout(finish, 8000);

    return () => {
      anim.removeEventListener('complete', finish);
      clearTimeout(fallback);
      anim.destroy();
    };
  }, [onFinished, minDelay]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f1220 0%, #1a1f3a 100%)',
        zIndex: 9999,
      }}
    >
      <div ref={containerRef} style={{ width: 428, height: 123, maxWidth: '90vw' }} />
      <div style={{ marginTop: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
        ailinkcat
      </div>
    </div>
  );
}