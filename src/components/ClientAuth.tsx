import React, {useState} from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  Phone,
  User,
  UserPlus,
} from 'lucide-react';
import {api, ApiError, setAuthToken} from '../lib/api';
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
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsRegistration(false);
    setLoading(true);
    try {
      const res =
        generalTab === 'login'
          ? await api.loginClient({whatsapp, password})
          : await api.registerClient({name, whatsapp, password, address});
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
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-[#000831] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Inicio</span>
          </button>
          <BrandLogo className="h-8 w-auto object-contain" />
          <div className="w-20" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-extrabold text-[#000000]">
              {generalTab === 'login'
                ? 'Acceso de Cliente'
                : 'Registro de Cliente'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {generalTab === 'login'
                ? 'Si ya estás registrado, ingresa directamente a tu panel con tu WhatsApp y contraseña.'
                : 'Si aún no tienes cuenta, regístrate para ingresar a tu panel y registrar tus tenis.'}
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
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
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
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
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
                  className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg bg-[#109173] px-3.5 text-xs font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Registrarme ahora con este WhatsApp</span>
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {generalTab === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-[#000831] mb-1.5">
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
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[#000831] mb-1.5">
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
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#000831] mb-1.5">
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
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-[#000831] cursor-pointer"
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
              <div>
                <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                  Dirección de entrega
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, número, colonia y código postal"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full min-h-[48px] rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors cursor-pointer"
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
                  className="font-bold text-[#109173] hover:underline cursor-pointer"
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
                  className="font-bold text-[#109173] hover:underline cursor-pointer"
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
