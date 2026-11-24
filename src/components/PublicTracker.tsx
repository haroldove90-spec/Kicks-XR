import React, {useCallback, useEffect, useState} from 'react';
import {ArrowLeft, QrCode, Search, ShoppingBag} from 'lucide-react';
import {api, subscribeToRealtimeUpdates} from '../lib/api';
import type {PublicOrderTrack} from '../types';
import {BrandLogo} from './BrandLogo';
import {OrderTimeline} from './OrderTimeline';
import {QRScannerModal} from './QRScannerModal';

interface PublicTrackerProps {
  onBack: () => void;
}

export const PublicTracker: React.FC<PublicTrackerProps> = ({onBack}) => {
  const [query, setQuery] = useState('KXR-1042');
  const [result, setResult] = useState<PublicOrderTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const performLookup = useCallback(async (folioOrBag: string) => {
    const cleaned = folioOrBag.trim();
    if (!cleaned) return;
    // Extract folio if QR payload is KICKSXR|KXR-1042|B-028|campus
    const normalized = cleaned.startsWith('KICKSXR|')
      ? cleaned.split('|')[1] || cleaned
      : cleaned;
    setQuery(normalized);
    setLoading(true);
    setError(null);
    try {
      const data = await api.trackOrder(normalized);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : 'No encontramos ese folio.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    performLookup('KXR-1042');
  }, [performLookup]);

  useEffect(() => {
    if (!result?.folio) return;
    return subscribeToRealtimeUpdates((ev) => {
      if (ev.type === 'orders') {
        performLookup(result.folio);
      }
    });
  }, [result?.folio, performLookup]);

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl mx-auto">
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
          <h1 className="font-display text-2xl font-extrabold text-[#000000]">
            Sigue tu pedido
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Consulta el estatus en vivo ingresando tu folio (ej. KXR-1042) o escaneando tu QR de pedido.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              performLookup(query);
            }}
            className="mt-5 flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Folio (KXR-1042) o Bolsa (B-028)"
                className="w-full min-h-[46px] rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-mono uppercase text-[#000831] focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#5B21B6]/30 bg-[#EFEAFF] px-4 text-sm font-semibold text-[#5B21B6] hover:bg-[#5B21B6] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="h-4 w-4" />
                <span>Escanear QR</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[46px] flex-1 sm:flex-none rounded-xl bg-[#109173] px-6 text-sm font-bold text-white hover:bg-[#0B755C] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loading ? 'Buscando...' : 'Consultar'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#EFEAFF] p-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#5B21B6] shrink-0">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-600">
                      Folio de pedido
                    </div>
                    <div className="font-mono text-2xl font-bold text-[#000831] tabular-nums">
                      {result.folio}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Código de bolsa</span>
                    <span className="font-mono font-bold text-[#000831]">
                      {result.bagCode}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Sede / Punto</span>
                    <span className="font-semibold text-[#000831] text-right">
                      {result.campusName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Servicio</span>
                    <span className="font-semibold text-[#000831] text-right">
                      {result.serviceName} ({result.pairs}{' '}
                      {result.pairs === 1 ? 'par' : 'pares'})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Devolución</span>
                    <span className="font-semibold text-[#000831]">
                      {result.deliveryMethod === 'delivery'
                        ? 'Entrega a domicilio'
                        : 'Recoger en punto'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Pago</span>
                    <span
                      className={`font-semibold ${
                        result.paymentStatus === 'Pagado'
                          ? 'text-[#109173]'
                          : 'text-[#5B21B6]'
                      }`}
                    >
                      {result.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-200 p-5">
                <h2 className="font-display text-base font-bold text-[#000000] mb-4">
                  Línea de tiempo en vivo
                </h2>
                <OrderTimeline
                  currentStatus={result.status}
                  history={result.history}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <QRScannerModal
        open={scannerOpen}
        title="Escanear QR de pedido"
        subtitle="Escanea el código QR generado al confirmar tu pedido"
        placeholder="KXR-1042"
        quickOptions={[
          {label: 'Folio KXR-1042', sublabel: 'Bolsa B-028 · Campus Central', value: 'KXR-1042'},
          {label: 'Folio KXR-1043', sublabel: 'Bolsa B-029 · Campus Central', value: 'KXR-1043'},
          {label: 'Folio KXR-1041', sublabel: 'Bolsa B-027 · Campus Norte', value: 'KXR-1041'},
        ]}
        onScan={(val) => {
          setScannerOpen(false);
          performLookup(val);
        }}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
};
