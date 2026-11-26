import React, {useEffect, useState} from 'react';
import {ArrowLeft, Clock, Loader2, LogOut, ShieldCheck} from 'lucide-react';
import type {AuthUser} from '../types';
import {BrandLogo} from './BrandLogo';
import {PWAInstallButton} from './PWAInstallButton';

export type HomeEntryTarget = 'client' | 'admin';

interface RoleSelectorHomeProps {
  initialView?: 'home' | 'services';
  enteringService?: boolean;
  user?: AuthUser | null;
  onSelect: (target: HomeEntryTarget) => void;
  onLogout?: () => void;
}

const ServicesHomeIcon: React.FC<{className?: string}> = ({className = 'h-12 w-12'}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* House roof & body */}
    <path
      d="M11 30L32 13L53 30"
      stroke="#FFFFFF"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 26.5V48C17 50.2091 18.7909 52 21 52H43C45.2091 52 47 50.2091 47 48V26.5"
      stroke="#FFFFFF"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Golden sparkle on roofline */}
    <path
      d="M46 13L47.3 16.7L51 18L47.3 19.3L46 23L44.7 19.3L41 18L44.7 16.7L46 13Z"
      fill="#F5B942"
    />
    {/* Golden wrench inside house */}
    <path
      d="M36.8 31.2C34.9 30.5 32.7 31 31.3 32.4C30.1 33.6 29.7 35.3 30 36.8L25.2 41.6C24.4 42.4 24.4 43.7 25.2 44.5C26 45.3 27.3 45.3 28.1 44.5L32.9 39.7C34.4 40 36.1 39.6 37.3 38.4C38.7 37 39.2 34.8 38.5 32.9L36 35.4L34.3 33.7L36.8 31.2Z"
      fill="#F5B942"
    />
  </svg>
);

const SneakerWashIcon: React.FC<{className?: string}> = ({className = 'h-14 w-14'}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Clean sparkling stars */}
    <path
      d="M46 11L47.3 14.7L51 16L47.3 17.3L46 21L44.7 17.3L41 16L44.7 14.7L46 11Z"
      fill="#8BAF03"
    />
    <path
      d="M17 15L17.9 17.6L20.5 18.5L17.9 19.4L17 22L16.1 19.4L13.5 18.5L16.1 17.6L17 15Z"
      fill="#FCF61C"
    />
    {/* Sneaker upper silhouette */}
    <path
      d="M11 42V29C11 27.5 12.6 26.7 13.8 27.6C16.4 29.6 20 30.8 23.2 29.4C25.5 28.4 27.2 26.2 28.6 24.2C29.4 23 31.1 22.9 32.1 23.9L38.6 30.6C40.5 32.5 43 33.8 45.7 34.3L50.8 35.2C52.9 35.6 54.5 37.5 54.5 39.7V42H11Z"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Sneaker laces */}
    <path d="M31 28.5L34.5 26" stroke="#8BAF03" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M34.5 32L38 29.5" stroke="#8BAF03" strokeWidth="2.6" strokeLinecap="round" />
    {/* Sneaker sole */}
    <path
      d="M10 42H55V45C55 46.7 53.7 48 52 48H13C11.3 48 10 46.7 10 45V42Z"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    {/* Water / shine accent wave */}
    <path
      d="M16 53C20 51.4 24 51.4 28 53C32 54.6 36 54.6 40 53C43 51.8 46 51.8 49 53"
      stroke="#8BAF03"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const WaterPumpIcon: React.FC<{className?: string}> = ({className = 'h-14 w-14'}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Top outlet pipe */}
    <path d="M27 14H39" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <path d="M33 14V21" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    {/* Left inlet pipe */}
    <path d="M10 27V39" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <path d="M10 33H19" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    {/* Motor housing */}
    <rect
      x="19"
      y="21"
      width="30"
      height="24"
      rx="5"
      stroke="#FFFFFF"
      strokeWidth="3"
    />
    {/* Motor fins */}
    <path d="M49 26H54V40H49" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
    {/* Stand feet */}
    <path d="M23 45L20 51H46L43 45" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {/* Water drop inside */}
    <path
      d="M34 26.5C34 26.5 29 31.8 29 35.1C29 37.9 31.2 40 34 40C36.8 40 39 37.9 39 35.1C39 31.8 34 26.5 34 26.5Z"
      fill="#8BAF03"
    />
  </svg>
);

const GasDeliveryIcon: React.FC<{className?: string}> = ({className = 'h-14 w-14'}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Cylinder handle / collar */}
    <path
      d="M23 19V14C23 12.9 23.9 12 25 12H39C40.1 12 41 12.9 41 14V19"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path d="M32 12V19" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    <path d="M28 16H36" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
    {/* Cylinder body */}
    <rect
      x="18"
      y="19"
      width="28"
      height="30"
      rx="8"
      stroke="#FFFFFF"
      strokeWidth="3"
    />
    {/* Base ring */}
    <path
      d="M22 49V52H42V49"
      stroke="#FFFFFF"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Flame symbol */}
    <path
      d="M32 25.5C34.2 28.5 37.5 31.6 37.5 35.6C37.5 38.9 35 41.5 32 41.5C29 41.5 26.5 38.9 26.5 35.6C26.5 33.4 27.6 31.5 28.9 30C29 31.7 30 32.6 30.8 32.8C30.4 30.2 31 27.4 32 25.5Z"
      fill="#8BAF03"
    />
  </svg>
);

interface ServiceCatalogCard {
  id: 'sneakers' | 'water-pump' | 'gas';
  title: string;
  subtitle: string;
  available: boolean;
  icon: React.ComponentType<{className?: string}>;
}

const SERVICE_CARDS: ServiceCatalogCard[] = [
  {
    id: 'sneakers',
    title: 'Lavado de tenis',
    subtitle: 'Disponible ahora',
    available: true,
    icon: SneakerWashIcon,
  },
  {
    id: 'water-pump',
    title: 'Bomba de agua',
    subtitle: 'Próximamente',
    available: false,
    icon: WaterPumpIcon,
  },
  {
    id: 'gas',
    title: 'Gas a domicilio',
    subtitle: 'Próximamente',
    available: false,
    icon: GasDeliveryIcon,
  },
];

export const RoleSelectorHome: React.FC<RoleSelectorHomeProps> = ({
  initialView = 'home',
  enteringService = false,
  user = null,
  onSelect,
  onLogout,
}) => {
  const [view, setView] = useState<'home' | 'services'>(initialView);
  const [comingSoonService, setComingSoonService] = useState<string | null>(null);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const handleServiceClick = (card: ServiceCatalogCard) => {
    if (card.available) {
      onSelect('client');
      return;
    }
    setComingSoonService(card.title);
  };

  return (
    <div className="min-h-screen w-full bg-[#06102B] text-white flex flex-col justify-between px-5 py-7 sm:px-8 sm:py-10">
      {view === 'home' ? (
        /* SCREEN 1: HOMELI HOME */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center gap-8 sm:gap-10">
          {/* Homeli Logo */}
          <BrandLogo
            variant="homeli"
            className="w-52 sm:w-60 h-auto object-contain select-none"
          />

          {/* Tagline */}
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-center text-white leading-snug tracking-wide max-w-xs text-balance">
            Tu vida más fácil,
            <br />
            en una sola app
          </h1>

          {/* Central Square "Servicios" Card */}
          <button
            type="button"
            onClick={() => setView('services')}
            className="group w-44 h-44 sm:w-48 sm:h-48 rounded-3xl border border-white/35 bg-[#09173B]/90 flex flex-col items-center justify-center gap-3.5 shadow-xl shadow-black/30 hover:border-[#F5B942] hover:bg-[#0D2050] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942] cursor-pointer"
          >
            <ServicesHomeIcon className="h-14 w-14 transition-transform duration-150 group-hover:scale-105" />
            <span className="font-display text-lg font-semibold text-white">
              Servicios
            </span>
          </button>

          {/* Install PWA CTA Button */}
          <div className="w-full flex justify-center pt-1">
            <PWAInstallButton variant="homeli-home" />
          </div>
        </div>
      ) : (
        /* SCREEN 2: ELIGE UN SERVICIO (SQUARE CARDS: 2 COLS MOBILE/TABLET, 3 COLS DESKTOP) */
        <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-4 pb-6 sm:pb-10">
            <button
              type="button"
              onClick={() => setView('home')}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-2xl border border-white/15 bg-[#0C1C45] px-4 text-sm font-semibold text-white hover:bg-[#132960] active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Inicio</span>
            </button>

            <BrandLogo
              variant="homeli"
              className="h-12 sm:h-14 w-auto object-contain select-none"
            />

            <div className="w-[92px]" aria-hidden="true" />
          </div>

          {/* Heading */}
          <div className="text-center my-4 sm:my-6 space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Elige un servicio
            </h1>
            <p className="text-sm sm:text-base text-white/75">
              Selecciona el servicio que necesitas hoy
            </p>
          </div>

          {/* Square Cards Grid: 2 cols on mobile & tablet, 3 cols on desktop */}
          <div className="my-auto py-6 w-full max-w-3xl mx-auto grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {SERVICE_CARDS.map((card) => {
              const Icon = card.icon;
              const isBusy = enteringService && card.available;
              return (
                <button
                  key={card.id}
                  type="button"
                  disabled={enteringService}
                  onClick={() => handleServiceClick(card)}
                  className={`group aspect-square rounded-3xl border p-4 sm:p-6 flex flex-col items-center justify-center text-center gap-3.5 transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942] cursor-pointer disabled:opacity-70 ${
                    card.available
                      ? 'border-white/35 bg-[#0A1940] hover:border-[#8BAF03] hover:bg-[#0F2357] shadow-lg shadow-black/25'
                      : 'border-white/20 bg-[#081536] hover:border-white/40 hover:bg-[#0C1D47]'
                  }`}
                >
                  <div
                    className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border transition-transform duration-150 group-hover:scale-105 ${
                      card.available
                        ? 'border-[#8BAF03]/40 bg-[#0D2152]'
                        : 'border-white/10 bg-[#06112E]'
                    }`}
                  >
                    {isBusy ? (
                      <Loader2 className="h-9 w-9 text-[#FCF61C] animate-spin" />
                    ) : (
                      <Icon className="h-12 w-12 sm:h-14 sm:w-14" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="font-display text-sm sm:text-base font-bold text-white leading-snug">
                      {card.title}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        card.available ? 'text-[#FCF61C]' : 'text-white/55'
                      }`}
                    >
                      {isBusy ? 'Abriendo...' : card.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom 2-Step Indicator + Discreet Admin Access */}
      <div className="w-full max-w-md mx-auto pt-6 flex flex-col items-center gap-4">
        <div
          className="h-1.5 w-36 overflow-hidden rounded-full bg-[#4B5F86]/65 flex"
          aria-hidden="true"
        >
          <div
            className={`h-full w-1/2 rounded-full transition-colors duration-200 ${
              view === 'home' ? 'bg-white' : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full w-1/2 rounded-full transition-colors duration-200 ${
              view === 'services' ? 'bg-white' : 'bg-transparent'
            }`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {user && (
            <span className="inline-flex items-center gap-2 min-h-[36px] px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white/80">
              {user.avatarDataUrl && (
                <img
                  src={user.avatarDataUrl}
                  alt={user.name}
                  className="h-5 w-5 rounded-full object-cover"
                />
              )}
              <span>Hola, {user.name.split(' ')[0]}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onSelect('admin')}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-medium text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acceso Administrador</span>
          </button>

          {user && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs font-medium text-white/55 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal "Próximamente" matching reference screenshot */}
      {comingSoonService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#030816]/80 backdrop-blur-sm p-5"
          onClick={() => setComingSoonService(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Servicio próximamente"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0B193D] p-7 sm:p-8 text-center shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#F5B942]/35 bg-[#1B2542]">
              <Clock className="h-8 w-8 text-[#F5B942]" />
            </div>

            <div className="space-y-2.5">
              <h2 className="font-display text-2xl font-bold text-white">
                Próximamente
              </h2>
              <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                El servicio de{' '}
                <strong className="font-bold text-white">
                  {comingSoonService}
                </strong>{' '}
                estará disponible muy pronto en Homeli.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setComingSoonService(null)}
              className="w-full min-h-[50px] rounded-2xl bg-white px-6 text-base font-bold text-[#06102B] hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
