import React, {useState} from 'react';
import {
  ArrowLeftRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import type {NotificationLog} from '../types';
import {BrandLogo, type BrandLogoVariant} from './BrandLogo';
import {PWAInstallButton} from './PWAInstallButton';

export interface NavModuleItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{className?: string}>;
  badgeCount?: number;
  hideOnMobileBar?: boolean;
}

interface AppShellProps {
  roleLabel: string;
  userName?: string;
  brandVariant?: BrandLogoVariant;
  exitLabel?: string;
  navItems: NavModuleItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  onOpenNotifications: () => void;
  onLogout: () => void;
  notifications?: NotificationLog[];
  switchRoleAction?: {
    label: string;
    shortLabel?: string;
    onSwitch: () => void;
  };
  quickAction?: {
    label: string;
    shortLabel?: string;
    icon: React.ComponentType<{className?: string}>;
    onClick: () => void;
  };
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  roleLabel,
  userName,
  brandVariant = 'homeli',
  exitLabel = 'Cerrar sesión',
  navItems,
  activeNav,
  onSelectNav,
  onOpenNotifications,
  onLogout,
  notifications = [],
  switchRoleAction,
  quickAction,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const mobileBarItems = navItems.filter((item) => !item.hideOnMobileBar);
  const QuickActionIcon = quickAction?.icon;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F8FAFC] text-[#1A1E2A]">
      {/* Unified Header */}
      <header className="sticky top-0 z-30 h-16 w-full bg-white border-b border-slate-200 px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <BrandLogo
            variant={brandVariant}
            className="h-7 sm:h-9 w-auto object-contain shrink-0 rounded-md"
          />
          <span className="h-5 w-px bg-slate-200 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex items-center gap-2">
            <span className="font-display text-xs sm:text-base font-bold text-[#1A1E2A] truncate">
              {roleLabel}
            </span>
            {userName && (
              <span className="hidden md:inline text-xs text-slate-500 truncate">
                · {userName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Quick Action (e.g., 1-Tap QR Scanner for Admin) */}
          {quickAction && QuickActionIcon && (
            <button
              type="button"
              onClick={quickAction.onClick}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#1A1E2A] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-extrabold text-[#FCF61C] hover:bg-[#11141D] transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              title={quickAction.label}
            >
              <QuickActionIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{quickAction.label}</span>
              <span className="sm:hidden">
                {quickAction.shortLabel || quickAction.label}
              </span>
            </button>
          )}

          {/* Admin 2-Role Switcher */}
          {switchRoleAction && (
            <button
              type="button"
              onClick={switchRoleAction.onSwitch}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-[#8BAF03]/45 bg-[#F3F8DE] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1A1E2A] hover:bg-[#8BAF03] hover:text-[#1A1E2A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={switchRoleAction.label}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{switchRoleAction.label}</span>
              <span className="sm:hidden">
                {switchRoleAction.shortLabel || switchRoleAction.label}
              </span>
            </button>
          )}

          {/* Notifications Bell Icon (Always visible in Header for Admin & Client) */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors shrink-0 cursor-pointer ${
              activeNav === 'notifications'
                ? 'border-[#8BAF03] bg-[#F3F8DE] text-[#1A1E2A]'
                : 'border-slate-200 bg-white text-[#1A1E2A] hover:bg-slate-50'
            }`}
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FCF61C] px-1 text-[10px] font-extrabold text-[#1A1E2A] ring-1 ring-[#1A1E2A]/20 tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <PWAInstallButton variant="header" />

          {/* Exit / Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#1A1E2A] hover:border-[#1A1E2A] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={exitLabel}
            aria-label={exitLabel}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{exitLabel}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace: Collapsible Desktop Sidebar + Full-Width Content */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full">
        {/* Desktop Collapsible Sidebar (#1A1E2A) */}
        <aside
          className={`hidden lg:flex flex-col justify-between bg-[#1A1E2A] text-white shrink-0 transition-[width] duration-200 ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          <div className="p-3 space-y-1.5">
            <div className="flex items-center justify-between px-2 py-2 mb-1">
              {!sidebarCollapsed && (
                <span className="text-xs font-semibold text-white/60">
                  Módulos
                </span>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-[#FCF61C] transition-colors cursor-pointer ${
                  sidebarCollapsed ? 'mx-auto' : ''
                }`}
                aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
                title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectNav(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      sidebarCollapsed
                        ? 'justify-center px-2'
                        : 'justify-between px-3.5'
                    } min-h-[46px] rounded-xl text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#8BAF03] text-[#1A1E2A] shadow-xs'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </span>
                    {!sidebarCollapsed &&
                      typeof item.badgeCount === 'number' &&
                      item.badgeCount > 0 && (
                        <span
                          className={`font-mono text-xs font-extrabold tabular-nums px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-[#1A1E2A] text-[#FCF61C]'
                              : 'bg-[#FCF61C] text-[#1A1E2A]'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-3 border-t border-white/10 space-y-2">
            {switchRoleAction && (
              <button
                type="button"
                onClick={switchRoleAction.onSwitch}
                title={sidebarCollapsed ? switchRoleAction.label : undefined}
                className={`w-full flex items-center ${
                  sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                } min-h-[44px] rounded-xl bg-[#FCF61C]/15 border border-[#FCF61C]/40 text-sm font-bold text-[#FCF61C] hover:bg-[#FCF61C] hover:text-[#1A1E2A] transition-colors whitespace-nowrap cursor-pointer`}
              >
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{switchRoleAction.label}</span>}
              </button>
            )}
            <PWAInstallButton variant="sidebar" collapsed={sidebarCollapsed} />
            <button
              type="button"
              onClick={onLogout}
              title={sidebarCollapsed ? exitLabel : undefined}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
              } min-h-[44px] rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap cursor-pointer`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{exitLabel}</span>}
            </button>
          </div>
        </aside>

        {/* Full-Width Main Viewport */}
        <main className="flex-1 min-w-0 w-full px-4 py-5 sm:px-6 lg:px-8 bottom-bar-offset">
          <div className="w-full max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile & Tablet Fixed Bottom Bar (#1A1E2A dark bar with #8BAF03 / #FCF61C active accent) */}
      <nav
        aria-label="Navegación principal"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1A1E2A] text-white border-t border-[#8BAF03]/40 shadow-[0_-4px_20px_rgba(26,30,42,0.22)] pb-safe"
      >
        <div
          className="grid items-center h-16 max-w-2xl mx-auto px-1"
          style={{
            gridTemplateColumns: `repeat(${mobileBarItems.length}, minmax(0, 1fr))`,
          }}
        >
          {mobileBarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                className={`relative flex flex-col items-center justify-center min-h-[48px] px-1 py-1 rounded-xl transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#8BAF03] text-[#1A1E2A]'
                    : 'text-white/80 hover:text-[#FCF61C]'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {typeof item.badgeCount === 'number' &&
                    item.badgeCount > 0 && (
                      <span
                        className={`absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold tabular-nums ${
                          isActive
                            ? 'bg-[#1A1E2A] text-[#FCF61C]'
                            : 'bg-[#FCF61C] text-[#1A1E2A]'
                        }`}
                      >
                        {item.badgeCount > 9 ? '9+' : item.badgeCount}
                      </span>
                    )}
                </div>
                <span className="mt-1 text-[10px] sm:text-[11px] font-bold leading-none truncate max-w-full">
                  {item.shortLabel || item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
