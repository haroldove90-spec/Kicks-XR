import React, {useEffect, useRef, useState} from 'react';
import {
  Heart,
  Home,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Wrench,
} from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

const PRIMARY_SPLASH_URL = 'https://daloocomercializadora.com.mx/homelisplash.png';
const LOCAL_SPLASH_URL = '/homelisplash.png';
const SPLASH_DURATION_MS = 5000;
const FADE_DURATION_MS = 350;

export const SplashScreen: React.FC<SplashScreenProps> = ({onFinish}) => {
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgSrc, setImgSrc] = useState(PRIMARY_SPLASH_URL);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / (SPLASH_DURATION_MS - FADE_DURATION_MS)) * 100);
      setProgress(pct);
      if (pct < 100) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);

    const fadeTimer = window.setTimeout(
      () => setFading(true),
      SPLASH_DURATION_MS - FADE_DURATION_MS,
    );
    const doneTimer = window.setTimeout(
      () => finishRef.current(),
      SPLASH_DURATION_MS,
    );

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#06102B] text-white overflow-hidden transition-opacity duration-350 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Full-height centered splash visual */}
      <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden px-4 pt-6 pb-2">
        <img
          src={imgSrc}
          alt="Homeli — Tu vida más fácil, en una sola app"
          referrerPolicy="no-referrer"
          onError={() => {
            if (imgSrc !== LOCAL_SPLASH_URL) {
              setImgSrc(LOCAL_SPLASH_URL);
            }
          }}
          className="max-h-[70vh] w-auto max-w-full object-contain select-none"
        />
      </div>

      {/* Bottom tagline + subtle lifestyle icons + horizontal progress loader */}
      <div className="w-full max-w-sm px-6 pb-10 pt-2 flex flex-col items-center gap-4 shrink-0">
        <p className="text-center font-display text-lg sm:text-xl font-medium text-white/95 leading-snug tracking-wide">
          Tu vida más fácil,
          <br />
          en una sola app
        </p>

        <div
          className="flex items-center justify-center gap-5 text-white/35 pt-1"
          aria-hidden="true"
        >
          <ShoppingBag className="h-4 w-4" />
          <Home className="h-4 w-4" />
          <MessageCircle className="h-4 w-4" />
          <Wrench className="h-4 w-4" />
          <Heart className="h-4 w-4" />
          <Sparkles className="h-4 w-4" />
        </div>

        <div
          className="h-1.5 w-48 sm:w-56 overflow-hidden rounded-full bg-[#4B5F86]/70 mt-1"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cargando Homeli"
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
            style={{width: `${progress}%`}}
          />
        </div>
      </div>
    </div>
  );
};
