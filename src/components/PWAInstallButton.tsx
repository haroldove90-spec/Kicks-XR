import React, {useState} from 'react';
import {CheckCircle2, Download} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'home' | 'homeli-home';
  collapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  collapsed = false,
}) => {
  const {isInstallable, isInstalled, isIOS, isInIframe, install} = usePWAInstall();
  const [justInstalled, setJustInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  if (isInstalled && !justInstalled) {
    return null;
  }

  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : '/';

  const handleClick = async () => {
    setInlineNotice(null);

    if (isInstallable) {
      setInstalling(true);
      const outcome = await install();
      setInstalling(false);
      if (outcome === 'accepted') {
        setJustInstalled(true);
      }
      return;
    }

    if (isIOS) {
      setInlineNotice('En Safari toca Compartir y luego Agregar a inicio.');
    } else {
      setInlineNotice(
        'Usa el ícono de instalar en la barra del navegador o menú ⋮ → Instalar aplicación.',
      );
    }
    window.setTimeout(() => setInlineNotice(null), 5000);
  };

  const buttonLabel = justInstalled
    ? 'App instalada'
    : installing
      ? 'Instalando...'
      : variant === 'homeli-home'
        ? 'Instalar App en tu celular'
        : variant === 'home' || variant === 'sidebar'
          ? 'Instalar App'
          : 'Instalar';

  const buttonClasses =
    variant === 'homeli-home'
      ? 'w-full max-w-[330px] inline-flex items-center justify-center gap-2.5 min-h-[52px] rounded-2xl bg-white px-6 py-3 text-sm sm:text-base font-bold text-[#06102B] shadow-lg shadow-black/25 hover:bg-slate-100 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer'
      : variant === 'sidebar'
        ? `flex w-full items-center ${
            collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
          } min-h-[44px] rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white hover:bg-[#8BAF03] hover:border-[#8BAF03] hover:text-[#1A1E2A] transition-colors whitespace-nowrap shrink-0 cursor-pointer`
        : variant === 'home'
          ? 'inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#1A1E2A] px-6 py-2.5 text-sm font-bold text-[#FCF61C] hover:bg-[#11141D] shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer'
          : 'inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#8BAF03] px-3.5 py-2 text-xs sm:text-sm font-extrabold text-[#1A1E2A] hover:bg-[#749402] transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  if (isInIframe && !isInstallable) {
    return (
      <a
        href={appUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses}
        title="Instalar Homeli en móvil o PC"
      >
        <Download className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{buttonLabel}</span>}
      </a>
    );
  }

  return (
    <div
      className={
        variant === 'home' || variant === 'homeli-home'
          ? 'w-full flex flex-col items-center gap-2.5'
          : 'inline-flex flex-col'
      }
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        className={buttonClasses}
        title="Instalar Homeli en dispositivo móvil o PC"
      >
        {justInstalled ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <Download className="h-4 w-4 shrink-0" />
        )}
        {!collapsed && <span>{buttonLabel}</span>}
      </button>

      {inlineNotice && (variant === 'home' || variant === 'homeli-home') && (
        <p
          className={`text-xs font-medium text-center max-w-xs ${
            variant === 'homeli-home' ? 'text-white/80' : 'text-slate-600'
          }`}
        >
          {inlineNotice}
        </p>
      )}
    </div>
  );
};
