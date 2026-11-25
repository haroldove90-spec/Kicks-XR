import React, {useCallback, useEffect, useState} from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import {api} from '../lib/api';
import type {MercadoPagoAdminConfig, PopupAlert} from '../types';

interface AdminMercadoPagoModuleProps {
  onRefreshOverview: () => void;
  onPushAlert: (alert: Omit<PopupAlert, 'id'>) => void;
}

export const AdminMercadoPagoModule: React.FC<AdminMercadoPagoModuleProps> = ({
  onRefreshOverview,
  onPushAlert,
}) => {
  const [loading, setLoading] = useState(true);
  const [mpConfig, setMpConfig] = useState<MercadoPagoAdminConfig | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(true);
  const [publicKey, setPublicKey] = useState('');
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.getMercadoPagoConfig();
      setMpConfig(res.config);
      setEnabled(res.config.enabled);
      setSandboxMode(res.config.sandboxMode);
      setPublicKey(res.config.publicKey || '');
    } catch (err) {
      onPushAlert({
        title: 'Error cargando Mercado Pago',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo consultar la configuración de Mercado Pago.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [onPushAlert]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await api.updateMercadoPagoConfig({
        enabled,
        sandboxMode,
        publicKey: publicKey.trim(),
        accessToken: accessTokenInput.trim() || undefined,
      });
      setMpConfig(res.config);
      setEnabled(res.config.enabled);
      setSandboxMode(res.config.sandboxMode);
      setPublicKey(res.config.publicKey || '');
      setAccessTokenInput('');
      onRefreshOverview();
      onPushAlert({
        title: 'Mercado Pago actualizado',
        message: res.config.enabled
          ? `Cobros con Mercado Pago ACTIVADOS (${res.config.sandboxMode ? 'Modo pruebas' : 'Producción'}).`
          : 'Configuración de Mercado Pago guardada correctamente.',
        tone: 'success',
      });
    } catch (err) {
      onPushAlert({
        title: 'No se pudo guardar',
        message:
          err instanceof Error
            ? err.message
            : 'Error guardando credenciales de Mercado Pago.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearToken = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await api.updateMercadoPagoConfig({
        clearAccessToken: true,
        enabled: false,
      });
      setMpConfig(res.config);
      setEnabled(false);
      setAccessTokenInput('');
      onRefreshOverview();
      onPushAlert({
        title: 'Access Token eliminado',
        message: 'Se desconectó la clave de Mercado Pago y se pausó en checkout.',
        tone: 'info',
      });
    } catch (err) {
      onPushAlert({
        title: 'Error',
        message:
          err instanceof Error ? err.message : 'No se pudo limpiar la clave.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testMercadoPagoConfig();
      const details = [
        res.nickname ? `Cuenta: ${res.nickname}` : null,
        res.email ? res.email : null,
        res.siteId ? `País: ${res.siteId}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const message = `Conexión exitosa con Mercado Pago.${details ? ` ${details}` : ''}`;
      setTestResult({ok: true, message});
      onPushAlert({
        title: 'Mercado Pago conectado',
        message,
        tone: 'success',
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo validar tu cuenta de Mercado Pago.';
      setTestResult({ok: false, message});
      onPushAlert({
        title: 'Error de conexión',
        message,
        tone: 'error',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#1A1E2A]">
            Módulo Mercado Pago
          </h1>
          <p className="text-sm text-slate-600">
            Conecta tu cuenta de Mercado Pago en 4 simples pasos para cobrar servicios directo desde el checkout de tus clientes.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold ${
            mpConfig?.enabled && mpConfig.hasAccessToken
              ? 'border-[#8BAF03] bg-[#F3F8DE] text-[#1A1E2A]'
              : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          <Wallet
            className={`h-4 w-4 ${
              mpConfig?.enabled && mpConfig.hasAccessToken
                ? 'text-[#5E7800]'
                : 'text-slate-400'
            }`}
          />
          <span>
            {mpConfig?.enabled && mpConfig.hasAccessToken
              ? `Activo en checkout · ${mpConfig.sandboxMode ? 'Pruebas' : 'Producción'}`
              : 'Desactivado en checkout'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Step-by-Step Admin Guide */}
        <div className="xl:col-span-5 rounded-2xl bg-[#1A1E2A] text-white p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCF61C] text-[#1A1E2A] shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold">
                Cómo obtener tus claves en 4 pasos
              </h2>
              <p className="text-xs text-white/70">
                Guía rápida para configurar tu cuenta de cobros
              </p>
            </div>
          </div>

          <ol className="space-y-3.5 text-xs sm:text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8BAF03] text-[#1A1E2A] font-mono text-xs font-extrabold shrink-0 mt-0.5">
                1
              </span>
              <div>
                <div className="font-bold text-white">
                  Entra a Mercado Pago Developers
                </div>
                <p className="text-white/75 text-xs mt-0.5 leading-relaxed">
                  Inicia sesión con la cuenta de Mercado Pago donde deseas recibir el dinero de tus servicios.
                </p>
                <a
                  href="https://www.mercadopago.com.mx/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold text-[#FCF61C] transition-colors"
                >
                  <span>Abrir panel de Mercado Pago Developers</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8BAF03] text-[#1A1E2A] font-mono text-xs font-extrabold shrink-0 mt-0.5">
                2
              </span>
              <div>
                <div className="font-bold text-white">
                  Crea o abre tu aplicación
                </div>
                <p className="text-white/75 text-xs mt-0.5 leading-relaxed">
                  Pulsa <strong>«Crear aplicación»</strong>, ponle nombre (ej. <em>Kicks XR</em>) y elige <strong>Pagos online → Checkout Pro</strong>.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8BAF03] text-[#1A1E2A] font-mono text-xs font-extrabold shrink-0 mt-0.5">
                3
              </span>
              <div>
                <div className="font-bold text-white">
                  Copia tu Public Key y Access Token
                </div>
                <p className="text-white/75 text-xs mt-0.5 leading-relaxed">
                  En el menú izquierdo entra a <strong>Credenciales de prueba</strong> (si quieres ensayar) o <strong>Credenciales de producción</strong> (para cobros reales) y copia ambas claves.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8BAF03] text-[#1A1E2A] font-mono text-xs font-extrabold shrink-0 mt-0.5">
                4
              </span>
              <div>
                <div className="font-bold text-white">
                  Pega tus claves, guarda y prueba la conexión
                </div>
                <p className="text-white/75 text-xs mt-0.5 leading-relaxed">
                  Pégalas en el formulario de la derecha, activa el interruptor de checkout y pulsa <strong>«Probar conexión»</strong>. ¡Listo para cobrar!
                </p>
              </div>
            </li>
          </ol>

          <div className="rounded-xl bg-white/10 border border-white/15 p-3.5 text-xs text-white/85 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#FCF61C] shrink-0 mt-0.5" />
            <span>
              Tu <strong>Access Token</strong> se guarda protegido en el servidor y nunca se envía al navegador de tus clientes.
            </span>
          </div>
        </div>

        {/* Right: Credentials Form */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#1A1E2A]">
                Configuración de cuenta Mercado Pago
              </h2>
              <p className="text-xs text-slate-600">
                Pega tus credenciales API para activar el cobro en el checkout del cliente
              </p>
            </div>
            {mpConfig?.hasAccessToken && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F3F8DE] border border-[#8BAF03]/35 px-3 py-1 text-xs font-bold text-[#5E7800]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Clave guardada ({mpConfig.accessTokenMasked})</span>
              </span>
            )}
          </div>

          {/* Toggle Enabled */}
          <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 cursor-pointer hover:border-[#8BAF03]/50 transition-colors">
            <div>
              <div className="font-display text-sm font-extrabold text-[#1A1E2A]">
                Activar Mercado Pago en Checkout del cliente
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Muestra la opción de pago con Mercado Pago al solicitar un servicio
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5 accent-[#8BAF03] cursor-pointer shrink-0"
            />
          </label>

          {/* Mode Selector: Sandbox vs Production */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-[#1A1E2A]">
              Entorno de cobro
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSandboxMode(true)}
                className={`rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                  sandboxMode
                    ? 'border-[#8BAF03] bg-[#F3F8DE]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-extrabold text-[#1A1E2A]">
                  Modo Pruebas (Sandbox)
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Usa credenciales TEST para ensayar cobros sin dinero real
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSandboxMode(false)}
                className={`rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                  !sandboxMode
                    ? 'border-[#8BAF03] bg-[#F3F8DE]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-extrabold text-[#1A1E2A]">
                  Modo Producción (Cobros reales)
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Usa credenciales APP_USR para recibir pagos reales en tu cuenta
                </div>
              </button>
            </div>
          </div>

          {/* Public Key */}
          <div>
            <label className="block text-sm font-bold text-[#1A1E2A] mb-1.5">
              Public Key (Clave pública)
            </label>
            <input
              type="text"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="Ej. APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-4 font-mono text-xs sm:text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
            />
          </div>

          {/* Access Token */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-sm font-bold text-[#1A1E2A]">
                Access Token (Clave privada de cobros)
              </label>
              {mpConfig?.hasAccessToken && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClearToken}
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar clave guardada</span>
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showToken ? 'text' : 'password'}
                value={accessTokenInput}
                onChange={(e) => setAccessTokenInput(e.target.value)}
                placeholder={
                  mpConfig?.hasAccessToken
                    ? 'Ya hay un token guardado · pega uno nuevo solo si deseas reemplazarlo'
                    : 'Ej. APP_USR-1234567890123456-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx'
                }
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 font-mono text-xs sm:text-sm text-[#1A1E2A] focus:border-[#8BAF03] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-[#1A1E2A] cursor-pointer"
                aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold ${
                testResult.ok
                  ? 'border-[#8BAF03]/40 bg-[#F3F8DE] text-[#1A1E2A]'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-w-[180px] min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Guardando...' : 'Guardar configuración'}</span>
            </button>

            <button
              type="button"
              disabled={testing || (!mpConfig?.hasAccessToken && !accessTokenInput)}
              onClick={handleTestConnection}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1E2A] px-5 text-sm font-bold text-[#FCF61C] hover:bg-[#11141D] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Probando...' : 'Probar conexión'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
