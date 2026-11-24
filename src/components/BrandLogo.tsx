import React, {useState} from 'react';

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

const PRIMARY_LOGO_URL = 'https://daloocomercializadora.com.mx/xrlogo.png';
const LOCAL_FALLBACK_URL = '/xrlogo.png';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-9 w-auto object-contain',
  alt = 'Kicks XR',
}) => {
  const [src, setSrc] = useState(PRIMARY_LOGO_URL);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="font-display text-2xl font-extrabold tracking-tight select-none whitespace-nowrap">
        <span className="text-[#000831]">Kicks</span>
        <span className="text-[#109173]">XR</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (src === PRIMARY_LOGO_URL) {
          setSrc(LOCAL_FALLBACK_URL);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};
