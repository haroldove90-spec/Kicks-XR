import React, {useEffect, useState} from 'react';

export type BrandLogoVariant = 'homeli' | 'kicksxr';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
}

const LOGOS: Record<BrandLogoVariant, {primary: string; fallback: string; defaultAlt: string}> = {
  homeli: {
    primary: 'https://daloocomercializadora.com.mx/homelilogo.png',
    fallback: '/homelilogo.png',
    defaultAlt: 'Homeli',
  },
  kicksxr: {
    primary: 'https://daloocomercializadora.com.mx/xrlogo2.png',
    fallback: '/xrlogo2.png',
    defaultAlt: 'Kicks XR',
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'homeli',
  className = 'h-9 w-auto object-contain',
  alt,
}) => {
  const asset = LOGOS[variant];
  const [src, setSrc] = useState(asset.primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(asset.primary);
    setFailed(false);
  }, [asset.primary]);

  if (failed) {
    if (variant === 'kicksxr') {
      return (
        <span className="font-display text-2xl font-extrabold tracking-tight select-none whitespace-nowrap">
          <span className="text-[#1A1E2A]">Kicks</span>
          <span className="text-[#8BAF03]">XR</span>
        </span>
      );
    }
    return (
      <span className="font-display text-2xl font-extrabold tracking-tight select-none whitespace-nowrap">
        <span className="text-[#06102B]">Hom</span>
        <span className="text-[#D4A017]">eli</span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || asset.defaultAlt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        if (src === asset.primary) {
          setSrc(asset.fallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};
