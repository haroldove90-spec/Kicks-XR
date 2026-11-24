import {useCallback, useEffect, useState} from 'react';
import {AdminApp} from './components/AdminApp';
import {AdminAuth} from './components/AdminAuth';
import {ClientApp} from './components/ClientApp';
import {ClientAuth} from './components/ClientAuth';
import {
  NotificationPopupHost,
  triggerDeviceNotification,
} from './components/NotificationPopupHost';
import {OfflineBanner} from './components/OfflineBanner';
import {
  RoleSelectorHome,
  type HomeEntryTarget,
} from './components/RoleSelectorHome';
import {SplashScreen} from './components/SplashScreen';
import {
  api,
  setAuthToken,
  setUnauthorizedHandler,
  subscribeToRealtimeUpdates,
} from './lib/api';
import {playNotificationSound, unlockNotificationAudio} from './lib/sound';
import type {AuthUser, PopupAlert, PublicConfig} from './types';

type AppRoute = 'home' | 'client-auth' | 'admin-auth' | 'client-app' | 'admin-app';

const FALLBACK_CONFIG: PublicConfig = {
  campuses: [
    {
      id: 'campus-central',
      name: 'Campus Central',
      code: 'KXR-CAMPUS-CENTRAL',
      address: 'Av. Universidad 3000, Módulo A, PB',
      type: 'point',
      active: true,
    },
    {
      id: 'campus-norte',
      name: 'Campus Norte',
      code: 'KXR-CAMPUS-NORTE',
      address: 'Blvd. Tecnológico 450, Edificio C',
      type: 'point',
      active: true,
    },
    {
      id: 'punto-roma',
      name: 'Punto KicksXR Roma',
      code: 'KXR-PUNTO-ROMA',
      address: 'Calle Orizaba 112, Col. Roma Norte',
      type: 'point',
      active: true,
    },
  ],
  services: [
    {
      id: 'svc-basic',
      name: 'Limpieza básica',
      description: 'Lavado exterior de suela, media suela y agujetas.',
      price: 180,
      turnaroundHours: 24,
      active: true,
    },
    {
      id: 'svc-premium',
      name: 'Limpieza premium',
      description:
        'Limpieza profunda interior y exterior, desodorización UV y acondicionamiento.',
      price: 290,
      turnaroundHours: 36,
      active: true,
    },
  ],
  shippingFee: 75,
  availableLockersByCampus: {},
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [route, setRoute] = useState<AppRoute>('home');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState<PublicConfig>(FALLBACK_CONFIG);
  const [alerts, setAlerts] = useState<PopupAlert[]>([]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener('pointerdown', unlock, {passive: true});
    window.addEventListener('keydown', unlock, {passive: true});
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const pushAlert = useCallback((alert: Omit<PopupAlert, 'id'>) => {
    const id = `pop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setAlerts((prev) => [{...alert, id}, ...prev].slice(0, 4));
    playNotificationSound(alert.tone || 'info');
    triggerDeviceNotification(`Kicks XR · ${alert.title}`, alert.message);
    window.setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 6500);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await api.getPublicConfig();
      if (data?.campuses?.length) {
        setConfig(data);
      }
    } catch {
      // keep fallback if temporarily offline
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      const targetRoute: AppRoute =
        user?.role === 'admin' ? 'admin-auth' : 'client-auth';
      setAuthToken(null);
      setUser(null);
      setRoute(targetRoute);
      pushAlert({
        title: 'Vuelve a iniciar sesión',
        message: 'Tu sesión expiró. Ingresa tus credenciales para continuar.',
        tone: 'warning',
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [user?.role, pushAlert]);

  useEffect(() => {
    loadConfig();
    return subscribeToRealtimeUpdates((ev) => {
      if (ev.type === 'config') {
        loadConfig();
      }
    });
  }, [loadConfig]);

  const handleSelectRole = (target: HomeEntryTarget) => {
    if (target === 'client') setRoute('client-auth');
    else if (target === 'admin') setRoute('admin-auth');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setRoute('home');
    pushAlert({
      title: 'Sesión cerrada',
      message: 'Has salido de forma segura de Kicks XR.',
      tone: 'info',
    });
  };

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const isAdminSession = user?.role === 'admin';

  return (
    <>
      <OfflineBanner />
      <NotificationPopupHost alerts={alerts} onDismiss={dismissAlert} />
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}

      {route === 'home' && <RoleSelectorHome onSelect={handleSelectRole} />}

      {route === 'client-auth' && (
        <ClientAuth
          onAuthenticated={(authUser) => {
            setUser(authUser);
            setRoute('client-app');
            pushAlert({
              title: `¡Bienvenido, ${authUser.name}!`,
              message:
                'Ya puedes registrar tus tenis, tomar fotografía de evidencia y rastrear tus pedidos.',
              tone: 'success',
            });
          }}
          onBack={() => setRoute('home')}
        />
      )}

      {route === 'admin-auth' && (
        <AdminAuth
          onAuthenticated={(authUser) => {
            setUser(authUser);
            setRoute('admin-app');
            pushAlert({
              title: `Sesión iniciada · ${authUser.name}`,
              message:
                'Acceso activo a Panel Administrador y Vista Cliente desde la cabecera.',
              tone: 'success',
            });
          }}
          onBack={() => setRoute('home')}
        />
      )}

      {route === 'client-app' && user && (
        <ClientApp
          user={user}
          config={config}
          onUserUpdated={setUser}
          onLogout={handleLogout}
          onPushAlert={pushAlert}
          onSwitchToAdmin={
            isAdminSession
              ? () => {
                  setRoute('admin-app');
                  pushAlert({
                    title: 'Modo Administrador',
                    message: 'Regresaste al panel operativo de Kicks XR.',
                    tone: 'info',
                  });
                }
              : undefined
          }
        />
      )}

      {route === 'admin-app' && user && (
        <AdminApp
          user={user}
          onLogout={handleLogout}
          onPushAlert={pushAlert}
          onSwitchToClient={() => {
            setRoute('client-app');
            pushAlert({
              title: 'Vista Cliente activa',
              message:
                'Estás navegando el flujo de Cliente con tu sesión de Administrador. Pulsa "Panel Admin" para volver.',
              tone: 'info',
            });
          }}
        />
      )}
    </>
  );
}
