import { useEffect, useRef } from 'react';
import './SplashScreen.css';

export default function SplashScreen({ onFinished }: {
  onFinished: () => void;
}) {
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    // animation runs ~1s, 6s fallback is plenty
    const fallback = setTimeout(() => onFinishedRef.current(), 6000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <div className="splash">
      <div className="splash-mark">
        <span className="splash-ring splash-ring-2" />
        <span className="splash-ring splash-ring-1" />
        <span className="splash-dot" />
      </div>
      <div
        className="splash-underline"
        onAnimationEnd={(e) => {
          if (e.animationName === 'splash-underline') onFinishedRef.current();
        }}
      />
      <div className="splash-wordmark">ailinkcat</div>
    </div>
  );
}
