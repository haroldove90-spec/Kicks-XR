import React from 'react';
import {ShieldCheck, User} from 'lucide-react';
import {BrandLogo} from './BrandLogo';
import {PWAInstallButton} from './PWAInstallButton';

export type HomeEntryTarget = 'client' | 'admin';

interface RoleSelectorHomeProps {
  onSelect: (target: HomeEntryTarget) => void;
}

const ROLE_CARDS: Array<{
  id: HomeEntryTarget;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  accentBg: string;
  accentColor: string;
}> = [
  {
    id: 'client',
    label: 'Cliente',
    icon: User,
    accentBg: 'bg-[#8BAF03]',
    accentColor: 'text-[#1A1E2A]',
  },
  {
    id: 'admin',
    label: 'Administrador',
    icon: ShieldCheck,
    accentBg: 'bg-[#1A1E2A]',
    accentColor: 'text-[#FCF61C]',
  },
];

export const RoleSelectorHome: React.FC<RoleSelectorHomeProps> = ({onSelect}) => {
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-10 sm:px-8">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* Un-encapsulated Logo */}
        <BrandLogo className="w-56 sm:w-64 md:w-72 h-auto object-contain mb-10 sm:mb-14" />

        {/* Clean 2-Role Selector: No Header, No Descriptions */}
        <div className="w-full grid grid-cols-2 gap-4 sm:gap-6">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelect(card.id)}
                className="group flex flex-col items-center justify-center gap-4 min-h-[176px] sm:min-h-[210px] rounded-2xl bg-white border border-slate-200 px-4 py-6 text-center transition-all duration-150 hover:border-[#8BAF03] hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BAF03] cursor-pointer"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl ${card.accentBg} ${card.accentColor} transition-transform duration-150 group-hover:scale-105`}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <span className="font-display text-base sm:text-lg font-bold text-[#1A1E2A] leading-snug">
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-10">
          <PWAInstallButton variant="home" />
        </div>
      </div>
    </div>
  );
};
