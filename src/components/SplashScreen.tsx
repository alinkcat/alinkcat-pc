import { useEffect, useRef } from 'react';
import splashData from '../assets/splash-lottie.json';

/**
 * 启动页：显示 Lottie 品牌动画（lottie-web 通过 index.html 的 <script> 标签加载，
 * 挂载到 window.lottie）。lottie-web.js 放在 public/ 下，Vite 原样 Serve。
 *
 * StrictMode 注意：dev 下 React 执行 setup→cleanup→setup。
 * 不能直接用 startedRef 跳过第二次 setup，因为 cleanup 已 destroy 了动画。
 * 因此每次 setup 都重新创建，cleanup 销毁。
 * finishedRef 防止 complete 和兜底超时双重触发 onFinished。
 */
export default function SplashScreen({ onFinished }: {
  onFinished: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const finishedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const anim = window.lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: splashData,
    });

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinishedRef.current();
    };

    anim.addEventListener('complete', finish);
    // 兜底：动画异常时 10 秒后放行
    const fallback = setTimeout(finish, 10000);

    return () => {
      anim.removeEventListener('complete', finish);
      clearTimeout(fallback);
      anim.destroy();
    };
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
