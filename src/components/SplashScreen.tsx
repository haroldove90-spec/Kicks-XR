import React, {useEffect, useRef, useState} from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const PRIMARY_SPLASH_ICON_URL = 'https://daloocomercializadora.com.mx/xricono2.png';
const LOCAL_SPLASH_ICON_URL = '/xricono2.png';

export const SplashScreen: React.FC<SplashScreenProps> = ({onFinish}) => {
  const [fading, setFading] = useState(false);
  const [iconSrc, setIconSrc] = useState(PRIMARY_SPLASH_ICON_URL);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 700);
    const doneTimer = window.setTimeout(() => finishRef.current(), 1000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <img
        src={iconSrc}
        alt="Kicks XR"
        referrerPolicy="no-referrer"
        onError={() => {
          if (iconSrc !== LOCAL_SPLASH_ICON_URL) {
            setIconSrc(LOCAL_SPLASH_ICON_URL);
          }
        }}
        className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain drop-shadow-sm"
      />
      <div className="mt-8 h-1.5 w-36 overflow-hidden rounded-full bg-[#1A1E2A]/10">
        <div className="h-full w-full origin-left animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#8BAF03] to-[#FCF61C]" />
      </div>
    </div>
  );
};
