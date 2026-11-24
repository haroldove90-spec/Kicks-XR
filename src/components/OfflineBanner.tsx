import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/usePWAInstall';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-[#1A1E2A] px-4 py-2 text-xs font-medium text-white shadow-lg border border-[#8BAF03]/40">
      <WifiOff className="h-3.5 w-3.5 text-[#FCF61C]" />
      <span>Sin conexión — Mostrando datos en caché local</span>
    </div>
  );
};
