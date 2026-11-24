import React, {useState} from 'react';
import {ArrowLeft, Lock, MapPin, Phone, User} from 'lucide-react';
import {api, setAuthToken} from '../lib/api';
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
  const [generalTab, setGeneralTab] = useState<'register' | 'login'>('register');

  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        generalTab === 'register'
          ? await api.registerClient({name, whatsapp, password, address})
          : await api.loginClient({whatsapp, password});
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
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
              {generalTab === 'register'
                ? 'Registro de Cliente'
                : 'Acceso de Cliente'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {generalTab === 'register'
                ? 'Crea tu cuenta para registrar tus tenis, subir fotografías y rastrear tus pedidos en vivo.'
                : 'Ingresa con tu número de WhatsApp y contraseña.'}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 mb-6">
            <button
              type="button"
              onClick={() => {
                setGeneralTab('register');
                setError(null);
              }}
              className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                generalTab === 'register'
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
              }`}
            >
              Crear cuenta
            </button>
            <button
              type="button"
              onClick={() => {
                setGeneralTab('login');
                setError(null);
              }}
              className={`flex-1 min-h-[42px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                generalTab === 'login'
                  ? 'bg-white text-[#000831] shadow-xs'
                  : 'text-slate-600 hover:text-[#000831]'
              }`}
            >
              Iniciar sesión
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
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
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                />
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
                : generalTab === 'register'
                  ? 'Registrarme y entrar'
                  : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
