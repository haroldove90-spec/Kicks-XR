import React, {useState} from 'react';
import {
  ArrowLeft,
  GraduationCap,
  Lock,
  MapPin,
  Phone,
  QrCode,
  User,
  Users,
} from 'lucide-react';
import {api, setAuthToken} from '../lib/api';
import type {AuthUser, Campus} from '../types';
import {BrandLogo} from './BrandLogo';
import {QRScannerModal} from './QRScannerModal';

interface ClientAuthProps {
  initialMode: 'general' | 'university';
  campuses: Campus[];
  onAuthenticated: (user: AuthUser) => void;
  onBack: () => void;
}

export const ClientAuth: React.FC<ClientAuthProps> = ({
  initialMode,
  campuses,
  onAuthenticated,
  onBack,
}) => {
  const [flowMode, setFlowMode] = useState<'general' | 'university'>(initialMode);
  const [generalTab, setGeneralTab] = useState<'register' | 'login'>('register');
  const [scannerOpen, setScannerOpen] = useState(false);

  // General form state
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');

  // University quick state
  const [uniName, setUniName] = useState('');
  const [uniWhatsapp, setUniWhatsapp] = useState('');
  const [selectedCampusCode, setSelectedCampusCode] = useState(
    campuses.find((c) => c.type === 'university')?.code || campuses[0]?.code || '',
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const universityCampuses = campuses.filter((c) => c.type === 'university');
  const scannableCampuses = universityCampuses.length > 0 ? universityCampuses : campuses;

  const handleGeneralSubmit = async (e: React.FormEvent) => {
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
      setError(err instanceof Error ? err.message : 'No se pudo completar el acceso.');
    } finally {
      setLoading(false);
    }
  };

  const handleCampusAccess = async (codeOverride?: string) => {
    const codeToUse = (codeOverride || selectedCampusCode).trim();
    if (!codeToUse) {
      setError('Escanea o selecciona un campus universitario para continuar.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.campusQuickLogin({
        campusCode: codeToUse,
        name: uniName.trim() || undefined,
        whatsapp: uniWhatsapp.trim() || undefined,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo validar el campus.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 flex flex-col">
      <div className="w-full max-w-5xl mx-auto">
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

        {/* Dual Onboarding Selector Banner (matches Reference Image 1) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => {
              setFlowMode('general');
              setError(null);
            }}
            className={`flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
              flowMode === 'general'
                ? 'border-[#109173] bg-[#E6F7F3]'
                : 'border-slate-200 bg-white hover:border-[#109173]/50'
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#000831] border border-[#109173]/25">
              <Users className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-[#000000]">
                Público general
              </h2>
              <p className="text-sm text-slate-600">
                Abre la app y regístrate o inicia sesión
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setFlowMode('university');
              setError(null);
            }}
            className={`flex items-center gap-4 rounded-2xl p-5 text-left border-2 transition-all cursor-pointer ${
              flowMode === 'university'
                ? 'border-[#5B21B6] bg-[#EFEAFF]'
                : 'border-slate-200 bg-white hover:border-[#5B21B6]/50'
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#5B21B6] border border-[#5B21B6]/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-extrabold text-[#000000]">
                Comunidad universitaria
              </h2>
              <p className="text-sm text-slate-600">
                Escanea el QR general del campus y genera tu QR de pedido
              </p>
            </div>
          </button>
        </div>

        {/* Form Container */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {flowMode === 'general' ? (
            <div className="max-w-xl mx-auto">
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

              <form onSubmit={handleGeneralSubmit} className="space-y-4">
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
                        placeholder="Tu nombre"
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
                      ? 'Registrarme y continuar'
                      : 'Entrar a Kicks XR'}
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="rounded-2xl bg-[#EFEAFF] border border-[#5B21B6]/20 p-6 flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#5B21B6] shadow-xs mb-4">
                  <QrCode className="h-9 w-9" />
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#000000]">
                  Escanea el QR general del campus
                </h3>
                <p className="mt-2 text-sm text-slate-700 max-w-sm">
                  Vincula tu pedido automáticamente a tu sede universitaria y genera tu código QR de pedido al instante.
                </p>

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="mt-6 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] transition-colors cursor-pointer"
                >
                  <QrCode className="h-5 w-5" />
                  <span>Abrir lector QR de campus</span>
                </button>
              </div>

              <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-[#000000]">
                  Acceso rápido por sede universitaria
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                    Campus / Sede
                  </label>
                  <select
                    value={selectedCampusCode}
                    onChange={(e) => setSelectedCampusCode(e.target.value)}
                    className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                  >
                    {scannableCampuses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                      Tu nombre (opcional)
                    </label>
                    <input
                      type="text"
                      value={uniName}
                      onChange={(e) => setUniName(e.target.value)}
                      placeholder="Ej. Ana López"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#000831] mb-1.5">
                      WhatsApp (opcional)
                    </label>
                    <input
                      type="tel"
                      value={uniWhatsapp}
                      onChange={(e) => setUniWhatsapp(e.target.value)}
                      placeholder="55 1234 5678"
                      className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleCampusAccess()}
                  className="w-full min-h-[48px] rounded-xl bg-[#000831] px-6 text-sm font-bold text-white hover:bg-[#000000] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loading ? 'Vinculando campus...' : 'Registrar mis tenis'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <QRScannerModal
        open={scannerOpen}
        title="Escanear QR del Campus"
        subtitle="Apunta al código QR ubicado en el punto Kicks XR de tu campus"
        placeholder="Ej. KXR-CAMPUS-CENTRAL"
        quickOptions={scannableCampuses.map((c) => ({
          label: c.name,
          sublabel: c.code,
          value: c.code,
        }))}
        onScan={(value) => {
          setScannerOpen(false);
          setSelectedCampusCode(value);
          handleCampusAccess(value);
        }}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
};
