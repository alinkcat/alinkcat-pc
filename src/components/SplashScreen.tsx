import { useEffect, useRef } from 'react';
import splashData from '../assets/splash-lottie.json';

/**
 * splash: shows a Lottie brand animation（lottie-web loaded via a <script> tag in index.html，
 * attached to window.lottie）。lottie-web.js is in public/，served as-is by Vite。
 *
 * StrictMode note: dev runs setup→cleanup→setup。
 * cannot skip the second setup via startedRef，because cleanup already destroyed the animation。
 * so each setup recreates，cleanup destroys。
 * finishedRef prevents double onFinished from complete + fallback timeout。
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
    // fallback: allow entry after 10 seconds if the animation errors
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
