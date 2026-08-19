import { useEffect, useRef, useState } from 'react';
import splashData from '../assets/splash-lottie.json';

/**
 * 启动页：显示 Lottie 品牌动画（lottie-web 通过 index.html 的 script 标签加载）。
 * 动画自然播放完（不设 minDelay）后调用 onFinished。
 * 用 ref 保护 StrictMode 双重渲染，防止动画卡顿重播。
 */
export default function SplashScreen({ onFinished }: {
  onFinished: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    // StrictMode 保护：只执行一次
    if (startedRef.current) return;
    startedRef.current = true;
    if (!containerRef.current) return;

    const anim = window.lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: splashData,
    });

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinished();
    };

    anim.addEventListener('complete', finish);
    // 兜底：动画异常时 10 秒后放行
    const fallback = setTimeout(finish, 10000);

    return () => {
      anim.removeEventListener('complete', finish);
      clearTimeout(fallback);
      anim.destroy();
    };
    // onFinished 用 ref 避免依赖变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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