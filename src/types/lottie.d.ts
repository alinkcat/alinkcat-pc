export interface LottieAnimation {
  loadAnimation: (opts: {
    container: Element;
    renderer: string;
    loop: boolean;
    autoplay: boolean;
    animationData: any;
  }) => {
    addEventListener: (event: string, cb: () => void) => void;
    removeEventListener: (event: string, cb: () => void) => void;
    destroy: () => void;
  };
}

declare global {
  interface Window {
    lottie: LottieAnimation;
  }
}