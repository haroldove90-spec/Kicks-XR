import {useCallback, useEffect, useState} from 'react';
import {AdminApp} from './components/AdminApp';
import {AdminAuth} from './components/AdminAuth';
import {ClientApp} from './components/ClientApp';
import {ClientAuth} from './components/ClientAuth';
import {OfflineBanner} from './components/OfflineBanner';
import {PublicTracker} from './components/PublicTracker';
import {
  RoleSelectorHome,
  type HomeEntryTarget,
} from './components/RoleSelectorHome';
import {SplashScreen} from './components/SplashScreen';
import {api, setAuthToken, subscribeToRealtimeUpdates} from './lib/api';
import type {AuthUser, PublicConfig} from './types';

type AppRoute =
  | 'home'
  | 'client-auth-general'
  | 'client-auth-university'
  | 'admin-auth'
  | 'public-track'
  | 'client-app'
  | 'admin-app';

const FALLBACK_CONFIG: PublicConfig = {
  campuses: [
    {
      id: 'campus-central',
      name: 'Campus Central',
      code: 'KXR-CAMPUS-CENTRAL',
      address: 'Av. Universidad 3000, Módulo A, PB',
      type: 'university',
      active: true,
    },
    {
      id: 'campus-norte',
      name: 'Campus Norte',
      code: 'KXR-CAMPUS-NORTE',
      address: 'Blvd. Tecnológico 450, Edificio C',
      type: 'university',
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
    loadConfig();
    return subscribeToRealtimeUpdates((ev) => {
      if (ev.type === 'config') {
        loadConfig();
      }
    });
  }, [loadConfig]);

  const handleSelectRole = (target: HomeEntryTarget) => {
    if (target === 'client') setRoute('client-auth-general');
    else if (target === 'university') setRoute('client-auth-university');
    else if (target === 'admin') setRoute('admin-auth');
    else if (target === 'track') setRoute('public-track');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setRoute('home');
  };

  return (
    <>
      <OfflineBanner />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {route === 'home' && <RoleSelectorHome onSelect={handleSelectRole} />}

      {(route === 'client-auth-general' ||
        route === 'client-auth-university') && (
        <ClientAuth
          initialMode={
            route === 'client-auth-university' ? 'university' : 'general'
          }
          campuses={config.campuses}
          onAuthenticated={(authUser) => {
            setUser(authUser);
            setRoute('client-app');
          }}
          onBack={() => setRoute('home')}
        />
      )}

      {route === 'admin-auth' && (
        <AdminAuth
          onAuthenticated={(authUser) => {
            setUser(authUser);
            setRoute('admin-app');
          }}
          onBack={() => setRoute('home')}
        />
      )}

      {route === 'public-track' && (
        <PublicTracker onBack={() => setRoute('home')} />
      )}

      {route === 'client-app' && user && (
        <ClientApp
          user={user}
          config={config}
          onUserUpdated={setUser}
          onLogout={handleLogout}
        />
      )}

      {route === 'admin-app' && user && (
        <AdminApp user={user} onLogout={handleLogout} />
      )}
    </>
  );
}
