import React, {useState} from 'react';
import {Download, Share, Smartphone, Monitor, X, CheckCircle2} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'home';
  collapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  collapsed = false,
}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled && !justInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setJustInstalled(true);
      } else if (outcome === 'manual') {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  const buttonClasses =
    variant === 'sidebar'
      ? `flex w-full items-center ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
        } min-h-[44px] rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white hover:bg-[#109173] hover:border-[#109173] transition-colors whitespace-nowrap shrink-0 cursor-pointer`
      : variant === 'home'
        ? 'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-[#109173]/30 bg-[#E6F7F3] px-5 py-2.5 text-sm font-semibold text-[#000831] hover:bg-[#109173] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        : 'inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#109173] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#0B755C] transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        title="Instalar aplicación Kicks XR"
      >
        {justInstalled ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <Download className="h-4 w-4 shrink-0" />
        )}
        {!collapsed && (
          <span>
            {justInstalled
              ? 'Instalada'
              : variant === 'home'
                ? 'Instalar app Kicks XR'
                : 'Instalar'}
          </span>
        )}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/60 p-4 backdrop-blur-xs"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 text-[#000831] shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#000000]">
                  Instalar Kicks XR
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Agrega Kicks XR a tu pantalla de inicio para acceso directo y modo aplicación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              {isIOS ? (
                <div className="rounded-xl bg-[#E6F7F3] p-4 border border-[#109173]/25">
                  <div className="flex items-center gap-2 font-semibold text-[#000831]">
                    <Share className="h-4 w-4 text-[#109173]" />
                    <span>En iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="mt-2.5 list-decimal pl-5 space-y-1.5 text-slate-700">
                    <li>
                      Toca el botón <strong>Compartir</strong> en la barra de Safari.
                    </li>
                    <li>
                      Desliza y elige <strong>Agregar a inicio</strong>.
                    </li>
                    <li>
                      Confirma tocando <strong>Agregar</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-[#E6F7F3] p-4 border border-[#109173]/25">
                    <div className="flex items-center gap-2 font-semibold text-[#000831]">
                      <Smartphone className="h-4 w-4 text-[#109173]" />
                      <span>Android (Chrome / Edge)</span>
                    </div>
                    <p className="mt-1.5 text-slate-700">
                      Abre el menú del navegador (<strong>⋮</strong>) y selecciona{' '}
                      <strong>Instalar aplicación</strong> o{' '}
                      <strong>Agregar a la pantalla principal</strong>.
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#EFEAFF] p-4 border border-[#5B21B6]/20">
                    <div className="flex items-center gap-2 font-semibold text-[#000831]">
                      <Monitor className="h-4 w-4 text-[#5B21B6]" />
                      <span>Computadora (Chrome / Edge)</span>
                    </div>
                    <p className="mt-1.5 text-slate-700">
                      Haz clic en el ícono de instalación en la barra de direcciones para abrir Kicks XR como aplicación de escritorio.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#109173] py-2.5 text-sm font-semibold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
