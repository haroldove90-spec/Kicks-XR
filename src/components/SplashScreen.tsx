import React, {useEffect, useState} from 'react';
import {BrandLogo} from './BrandLogo';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({onFinish}) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 950);
    const doneTimer = window.setTimeout(() => onFinish(), 1300);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <BrandLogo className="w-60 sm:w-72 md:w-80 h-auto object-contain" />
      <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-full origin-left animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-[#109173]" />
      </div>
    </div>
  );
};
