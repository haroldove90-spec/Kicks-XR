import React, {useState} from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import type {NotificationLog, PopupAlert} from '../types';
import {triggerDeviceNotification} from './NotificationPopupHost';

interface NotificationsCenterProps {
  notifications: NotificationLog[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onPushAlert?: (alert: Omit<PopupAlert, 'id'>) => void;
  onOpenFolio?: (folio: string) => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onPushAlert,
  onOpenFolio,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [permissionState, setPermissionState] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible =
    filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onPushAlert?.({
        title: 'Notificaciones en pantalla activas',
        message:
          'Este navegador no soporta notificaciones nativas del sistema, pero recibirás todos los popups en vivo dentro de Kicks XR.',
        tone: 'info',
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      if (result === 'granted') {
        triggerDeviceNotification(
          'Kicks XR · Notificaciones activas',
          'Recibirás alertas en vivo sobre tus servicios, estatus y entregas.',
        );
        onPushAlert?.({
          title: 'Permiso de notificaciones concedido',
          message:
            'Recibirás alertas en tiempo real en tu dispositivo y popups dentro de Kicks XR.',
          tone: 'success',
        });
      } else {
        onPushAlert?.({
          title: 'Permiso de notificaciones no concedido',
          message:
            'Puedes habilitarlo en los ajustes del navegador. Seguirás recibiendo popups en la app.',
          tone: 'warning',
        });
      }
    } catch {
      onPushAlert?.({
        title: 'No se pudo solicitar permiso',
        message: 'Las alertas emergentes dentro de la app permanecen activas.',
        tone: 'warning',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Notificaciones
          </h1>
          <p className="text-sm text-slate-600">
            Alertas en tiempo real sobre estatus de limpieza, recepción, incidencias y entregas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissionState !== 'granted' && (
            <button
              type="button"
              onClick={requestPushPermission}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-[#000831] px-4 text-xs sm:text-sm font-bold text-white hover:bg-[#000000] transition-colors cursor-pointer"
            >
              <BellRing className="h-4 w-4 text-[#109173]" />
              <span>Activar alertas del dispositivo</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-[#000831] hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <CheckCheck className="h-4 w-4 text-[#109173]" />
              <span>Marcar todas leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-[#000831] shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filter === 'unread'
                ? 'bg-white text-[#000831] shadow-xs'
                : 'text-slate-600'
            }`}
          >
            Sin leer ({unreadCount})
          </button>
        </div>

        <span className="text-xs text-slate-500">
          {permissionState === 'granted'
            ? 'Notificaciones del dispositivo activadas'
            : 'Popups en vivo activos en toda la app'}
        </span>
      </div>

      {/* Notification List */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#000831]">
              {filter === 'unread'
                ? 'No tienes notificaciones pendientes por leer.'
                : 'Aún no hay notificaciones registradas.'}
            </p>
          </div>
        ) : (
          visible.map((ntf) => (
            <div
              key={ntf.id}
              className={`p-4 sm:p-5 transition-colors ${
                ntf.read ? 'bg-white' : 'bg-[#E6F7F3]/45'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-extrabold text-[#000831]">
                      {ntf.title}
                    </span>
                    {ntf.folio && (
                      <span className="font-mono text-xs font-bold text-[#5B21B6]">
                        · {ntf.folio}
                      </span>
                    )}
                    {!ntf.read && (
                      <span className="text-[11px] font-bold text-[#109173]">
                        · Nueva
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {ntf.message}
                  </p>
                  <div className="text-xs font-mono text-slate-400 tabular-nums">
                    {new Date(ntf.createdAt).toLocaleString('es-MX')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ntf.folio && onOpenFolio && (
                    <button
                      type="button"
                      onClick={() => onOpenFolio(ntf.folio!)}
                      className="min-h-[36px] rounded-xl bg-[#109173] px-3 text-xs font-bold text-white hover:bg-[#0B755C] cursor-pointer"
                    >
                      Ver pedido
                    </button>
                  )}
                  {ntf.whatsappUrl && (
                    <a
                      href={ntf.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[36px] rounded-xl border border-[#109173]/30 bg-[#E6F7F3] px-3 text-xs font-bold text-[#109173] hover:bg-[#109173] hover:text-white transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {!ntf.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(ntf.id)}
                      className="inline-flex items-center gap-1 min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:text-[#000831] cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Leída</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
