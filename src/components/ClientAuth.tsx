import React, {useState} from 'react';
import {
  ArrowLeft,
  AtSign,
  Calendar,
  Eye,
  EyeOff,
  IdCard,
  Link2,
  Lock,
  MapPin,
  Phone,
  User,
  UserPlus,
} from 'lucide-react';
import {api, ApiError, setAuthToken} from '../lib/api';
import {isSafeGoogleMapsUrl} from '../lib/qrPayload';
import type {AuthUser} from '../types';
import {BrandLogo} from './BrandLogo';

interface ClientAuthProps {
  onAuthenticated: (user: AuthUser) => void;
  onBack: () => void;
}

export const ClientAuth: React.FC<ClientAuthProps> = ({
  onAuthenticated,
  onBack,
}) => {
  // Default to login so registered users go straight to their dashboard
  const [generalTab, setGeneralTab] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [age, setAge] = useState('');
  const [idDocumentNumber, setIdDocumentNumber] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsRegistration(false);

    if (generalTab === 'register') {
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge < 12 || parsedAge > 120) {
        setError('Ingresa una edad válida (entre 12 y 120 años).');
        return;
      }
      if (idDocumentNumber.trim().length < 5) {
        setError('Ingresa tu número de INE o Pasaporte (mínimo 5 caracteres).');
        return;
      }
      const trimmedMaps = mapsUrl.trim();
      if (trimmedMaps && !isSafeGoogleMapsUrl(trimmedMaps)) {
        setError(
          'El enlace de ubicación debe ser un link válido de Google Maps (ej. https://maps.app.goo.gl/...).',
        );
        return;
      }
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      const res =
        generalTab === 'login'
          ? await api.loginClient({username: cleanUsername, password})
          : await api.registerClient({
              name: name.trim(),
              username: cleanUsername,
              whatsapp: whatsapp.trim(),
              password,
              address: address.trim(),
              mapsUrl: mapsUrl.trim() || undefined,
              age: Number(age),
              idDocumentNumber: idDocumentNumber.trim().toUpperCase(),
            });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_REGISTERED') {
        setNeedsRegistration(true);
      }
      setError(
        err instanceof Error ? err.message : 'No se pudo completar el acceso.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 flex flex-col">
      <div className="w-full max-w-xl mx-auto my-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-[#1A1E2A] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Inicio</span>
          </button>
          <BrandLogo className="h-9 w-auto object-contain" />
          <div className="w-20" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
              {generalTab === 'login'
                ? 'Acceso de Cliente'
                : 'Registro de Cliente'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {generalTab === 'login'
                ? 'Si ya estás registrado, ingresa directamente a tu panel con tu usuario y contraseña.'
                : 'Completa tus datos, identificación (INE o Pasaporte) y ubicación para crear tu cuenta y generar tus órdenes con código QR.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 mb-6">
            <button
              type="button"
              onClick={() => {
                setGeneralTab('login');
                setError(null);
                setNeedsRegistration(false);
              }}
              className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                generalTab === 'login'
                  ? 'bg-white text-[#1A1E2A] shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1E2A]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setGeneralTab('register');
                setError(null);
                setNeedsRegistration(false);
              }}
              className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                generalTab === 'register'
                  ? 'bg-white text-[#1A1E2A] shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1E2A]'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 space-y-2.5">
              <p>{error}</p>
              {needsRegistration && (
                <button
                  type="button"
                  onClick={() => {
                    setGeneralTab('register');
                    setError(null);
                    setNeedsRegistration(false);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg bg-[#8BAF03] px-3.5 text-xs font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Registrarme ahora con este usuario</span>
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {generalTab === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                {generalTab === 'login' ? 'Nombre de usuario' : 'Usuario'}
              </label>
              <div className="relative">
                {generalTab === 'login' ? (
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                ) : (
                  <AtSign className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                )}
                <input
                  type="text"
                  required
                  minLength={3}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    generalTab === 'login'
                      ? 'Ingresa tu usuario'
                      : 'Ej. juan.perez (sin espacios)'
                  }
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                />
              </div>
            </div>

            {generalTab === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8">
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="55 1234 5678"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Edad
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="number"
                      required
                      min={12}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="Ej. 24"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={
                    generalTab === 'login' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    generalTab === 'login'
                      ? 'Ingresa tu contraseña'
                      : 'Mínimo 6 caracteres'
                  }
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-[#1A1E2A] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {generalTab === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Número de INE o Pasaporte
                  </label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      minLength={5}
                      maxLength={40}
                      value={idDocumentNumber}
                      onChange={(e) =>
                        setIdDocumentNumber(e.target.value.toUpperCase())
                      }
                      placeholder="Clave de elector / IDMEX o número de pasaporte"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm uppercase text-[#1A1E2A] placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Dirección
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Calle, número, colonia y código postal"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                    Enlace de ubicación en Google Maps
                  </label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/sL7aFF4pg11drELH9"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Abre Google Maps, pulsa «Compartir» en tu ubicación y pega aquí el enlace para entregas y recolección.
                  </p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full min-h-[48px] rounded-xl bg-[#8BAF03] px-6 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading
                ? 'Verificando...'
                : generalTab === 'login'
                  ? 'Entrar a mi dashboard'
                  : 'Registrarme y entrar'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            {generalTab === 'login' ? (
              <>
                ¿Aún no tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setGeneralTab('register');
                    setError(null);
                    setNeedsRegistration(false);
                  }}
                  className="font-bold text-[#5E7800] hover:underline cursor-pointer"
                >
                  Regístrate aquí
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes una cuenta registrada?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setGeneralTab('login');
                    setError(null);
                    setNeedsRegistration(false);
                  }}
                  className="font-bold text-[#5E7800] hover:underline cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
