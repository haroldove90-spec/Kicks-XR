import React, {useState} from 'react';
import {ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, User} from 'lucide-react';
import {api, setAuthToken} from '../lib/api';
import type {AuthUser} from '../types';
import {BrandLogo} from './BrandLogo';

interface AdminAuthProps {
  onAuthenticated: (user: AuthUser) => void;
  onBack: () => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({
  onAuthenticated,
  onBack,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.loginAdmin({username: username.trim(), password});
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Usuario o contraseña incorrectos.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] px-4 py-6 sm:px-6 flex flex-col">
      <div className="w-full max-w-lg mx-auto my-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-[#1A1E2A] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Inicio</span>
          </button>
          <BrandLogo className="h-8 w-auto object-contain" />
          <div className="w-20" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1E2A] text-[#FCF61C] shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-[#1A1E2A]">
                Acceso Administrador
              </h1>
              <p className="text-sm text-slate-600">
                Acceso exclusivo con usuario y contraseña autorizados
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/25"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1E2A] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/25"
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

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full min-h-[48px] rounded-xl bg-[#8BAF03] px-6 text-sm font-extrabold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Validando acceso...' : 'Ingresar al Panel'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            El registro público de administradores está deshabilitado. Solicita tus
            credenciales a un administrador activo.
          </p>
        </div>
      </div>
    </div>
  );
};
