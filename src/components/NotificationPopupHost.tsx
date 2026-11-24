import React from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Info,
  MessageSquare,
  X,
} from 'lucide-react';
import type {PopupAlert} from '../types';

export function triggerDeviceNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      });
    } catch {
      // Some mobile browsers require ServiceWorkerRegistration.showNotification
      navigator.serviceWorker?.ready
        ?.then((reg) =>
          reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
          }),
        )
        .catch(() => {});
    }
  }
}

interface NotificationPopupHostProps {
  alerts: PopupAlert[];
  onDismiss: (id: string) => void;
}

export const NotificationPopupHost: React.FC<NotificationPopupHostProps> = ({
  alerts,
  onDismiss,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2.5 sm:w-full sm:max-w-sm pointer-events-none"
    >
      {alerts.map((alert) => {
        const tone = alert.tone || 'info';
        const icon =
          tone === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-[#109173] shrink-0" />
          ) : tone === 'warning' ? (
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          ) : tone === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <Bell className="h-5 w-5 text-[#109173] shrink-0" />
          );

        return (
          <div
            key={alert.id}
            role="status"
            className="pointer-events-auto rounded-2xl bg-white border border-slate-200 shadow-[0_14px_40px_rgba(0,8,49,0.18)] p-4 text-[#000831] transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6F7F3] shrink-0">
                {icon || <Info className="h-5 w-5 text-[#109173]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-display text-sm font-extrabold text-[#000000] leading-snug">
                    {alert.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => onDismiss(alert.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#000831] cursor-pointer shrink-0 -mr-1 -mt-1"
                    aria-label="Cerrar notificación"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {alert.message}
                </p>

                {(alert.actionLabel || alert.whatsappUrl) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {alert.actionLabel && alert.onAction && (
                      <button
                        type="button"
                        onClick={() => {
                          alert.onAction?.();
                          onDismiss(alert.id);
                        }}
                        className="min-h-[32px] rounded-lg bg-[#109173] px-3 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                      >
                        {alert.actionLabel}
                      </button>
                    )}
                    {alert.whatsappUrl && (
                      <a
                        href={alert.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 min-h-[32px] rounded-lg border border-[#109173]/30 bg-[#E6F7F3] px-2.5 text-xs font-bold text-[#109173] hover:bg-[#109173] hover:text-white transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
