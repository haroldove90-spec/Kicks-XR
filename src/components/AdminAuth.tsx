import React, {useEffect, useState} from 'react';
import {ArrowLeft, Lock, ShieldCheck, User} from 'lucide-react';
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
  const [statusLoading, setStatusLoading] = useState(true);
  const [configured, setConfigured] = useState(true);

  const [name, setName] = useState('Harold Anguiano');
  const [username, setUsername] = useState('haroldo90');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getAdminStatus()
      .then((res) => {
        if (!active) return;
        setConfigured(res.configured);
        if (res.adminUsernameHint) setUsername(res.adminUsernameHint);
      })
      .catch(() => {
        if (active) setError('No se pudo verificar el estado de acceso.');
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!configured && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = configured
        ? await api.loginAdmin({username, password})
        : await api.setupAdmin({name, username, password});
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación.');
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
            className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-[#000831] hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Inicio</span>
          </button>
          <BrandLogo className="h-8 w-auto object-contain" />
          <div className="w-20" />
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#000831] text-white shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-[#000000]">
                {statusLoading
                  ? 'Verificando acceso...'
                  : configured
                    ? 'Acceso Administrador'
                    : 'Configurar cuenta Administrador'}
              </h1>
              <p className="text-sm text-slate-600">
                {configured
                  ? 'Ingresa con tu usuario (ej. haroldo90 o admin_1) y contraseña'
                  : 'Primer inicio: registra tu usuario y contraseña de administrador'}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {statusLoading ? (
            <div className="space-y-3 py-4">
              <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!configured && (
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
                      placeholder="Harold Anguiano"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                  Usuario o correo
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="haroldo90 o admin_1"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                  {configured ? 'Contraseña' : 'Nueva contraseña'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={configured ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  />
                </div>
              </div>

              {!configured && (
                <div>
                  <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full min-h-[48px] rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Validando...'
                  : configured
                    ? 'Ingresar al Panel'
                    : 'Guardar acceso e ingresar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
