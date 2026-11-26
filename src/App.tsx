import {useCallback, useEffect, useState} from 'react';
import {AdminApp} from './components/AdminApp';
import {AdminAuth} from './components/AdminAuth';
import {ClientApp} from './components/ClientApp';
import {HomeliOnboardingFlow} from './components/HomeliOnboardingFlow';
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
import type {AuthUser, HomeliLanguage, PopupAlert, PublicConfig} from './types';

type AppRoute =
  | 'onboarding'
  | 'home'
  | 'admin-auth'
  | 'client-app'
  | 'admin-app';

const GUEST_DEVICE_STORAGE_KEY = 'homeli_guest_device_id';
const REGISTERED_DEVICE_STORAGE_KEY = 'homeli_device_registered';
const REMEMBERED_EMAIL_STORAGE_KEY = 'homeli_remembered_email';
const LANGUAGE_STORAGE_KEY = 'homeli_language';

function readStoredFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function readStoredString(key: string): string {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function getOrCreateGuestDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_DEVICE_STORAGE_KEY);
    if (existing && existing.length >= 6) {
      return existing;
    }
    const created = `dev-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    window.localStorage.setItem(GUEST_DEVICE_STORAGE_KEY, created);
    return created;
  } catch {
    return `dev-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

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
      name: 'Punto Homeli Roma',
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
  const [isDeviceRegistered, setIsDeviceRegistered] = useState<boolean>(() =>
    readStoredFlag(REGISTERED_DEVICE_STORAGE_KEY),
  );
  const [rememberedEmail, setRememberedEmail] = useState<string>(() =>
    readStoredString(REMEMBERED_EMAIL_STORAGE_KEY),
  );
  const [savedLanguage, setSavedLanguage] = useState<HomeliLanguage>(() =>
    readStoredString(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'es',
  );
  const [route, setRoute] = useState<AppRoute>('onboarding');
  const [homeInitialView, setHomeInitialView] = useState<'home' | 'services'>(
    'home',
  );
  const [enteringService, setEnteringService] = useState(false);
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
    triggerDeviceNotification(`Homeli · ${alert.title}`, alert.message);
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

  const enterSneakerService = useCallback(async () => {
    if (user) {
      setRoute('client-app');
      return;
    }
    setEnteringService(true);
    try {
      const deviceId = getOrCreateGuestDeviceId();
      const res = await api.startGuestClientSession(deviceId);
      setAuthToken(res.token);
      setUser(res.user);
      setRoute('client-app');
    } catch (err) {
      pushAlert({
        title: 'No se pudo abrir el servicio',
        message:
          err instanceof Error
            ? err.message
            : 'Verifica tu conexión e inténtalo nuevamente.',
        tone: 'error',
      });
    } finally {
      setEnteringService(false);
    }
  }, [user, pushAlert]);

  // Handle Mercado Pago return URL parameters on initial load so payment confirmation is seamless
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mpStatus = params.get('mp_status');
    const orderId = params.get('order_id');

    if (mpStatus && orderId) {
      void enterSneakerService();
    }
    // Run only once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (user?.role === 'admin') {
        setAuthToken(null);
        setUser(null);
        setRoute('admin-auth');
        pushAlert({
          title: 'Vuelve a iniciar sesión',
          message: 'Tu sesión de administrador expiró. Ingresa tus credenciales.',
          tone: 'warning',
        });
        return;
      }

      setAuthToken(null);
      setUser(null);
      setRoute('onboarding');
      pushAlert({
        title: 'Sesión finalizada',
        message: 'Ingresa nuevamente a tu cuenta de Homeli para continuar.',
        tone: 'info',
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

  const handleOnboardingAuthenticated = (
    authUser: AuthUser,
    remembered?: string,
  ) => {
    try {
      window.localStorage.setItem(REGISTERED_DEVICE_STORAGE_KEY, 'true');
      if (remembered && remembered.trim()) {
        window.localStorage.setItem(
          REMEMBERED_EMAIL_STORAGE_KEY,
          remembered.trim(),
        );
        setRememberedEmail(remembered.trim());
      } else if (remembered === '') {
        window.localStorage.removeItem(REMEMBERED_EMAIL_STORAGE_KEY);
        setRememberedEmail('');
      }
      if (authUser.language === 'es' || authUser.language === 'en') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, authUser.language);
        setSavedLanguage(authUser.language);
      }
    } catch {
      // ignore storage restrictions
    }

    setIsDeviceRegistered(true);
    setUser(authUser);
    setHomeInitialView('home');
    setRoute('home');
    pushAlert({
      title: `Bienvenido, ${authUser.name.split(' ')[0]}`,
      message: 'Tu cuenta de Homeli está lista. Explora nuestros servicios.',
      tone: 'success',
    });
  };

  const handleSelectRole = (target: HomeEntryTarget) => {
    if (target === 'client') {
      void enterSneakerService();
    } else if (target === 'admin') {
      if (user?.role === 'admin') {
        setRoute('admin-app');
      } else {
        setRoute('admin-auth');
      }
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setHomeInitialView('home');
    setRoute('onboarding');
    pushAlert({
      title: 'Sesión cerrada',
      message: 'Has salido de forma segura de Homeli.',
      tone: 'info',
    });
  };

  const handleExitClientToServices = () => {
    setHomeInitialView('services');
    setRoute('home');
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

      {route === 'onboarding' && (
        <HomeliOnboardingFlow
          isReturningUser={isDeviceRegistered}
          rememberedEmail={rememberedEmail}
          initialLanguage={savedLanguage}
          onAuthenticated={handleOnboardingAuthenticated}
          onAdminAccess={() => setRoute('admin-auth')}
          onPushAlert={pushAlert}
        />
      )}

      {route === 'home' && (
        <RoleSelectorHome
          initialView={homeInitialView}
          enteringService={enteringService}
          user={user}
          onSelect={handleSelectRole}
          onLogout={handleLogout}
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
          onBack={() => {
            if (user) {
              setHomeInitialView('home');
              setRoute('home');
            } else {
              setRoute('onboarding');
            }
          }}
        />
      )}

      {route === 'client-app' && user && (
        <ClientApp
          user={user}
          config={config}
          onUserUpdated={setUser}
          onLogout={isAdminSession ? handleLogout : handleExitClientToServices}
          onPushAlert={pushAlert}
          onSwitchToAdmin={
            isAdminSession
              ? () => {
                  setRoute('admin-app');
                  pushAlert({
                    title: 'Modo Administrador',
                    message: 'Regresaste al panel operativo de Homeli.',
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
                'Estás navegando el flujo de Lavado de tenis con tu sesión de Administrador. Pulsa "Panel Admin" para volver.',
              tone: 'info',
            });
          }}
        />
      )}
    </>
  );
}
