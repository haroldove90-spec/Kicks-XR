import React, {useEffect, useRef, useState} from 'react';
import {Camera, QrCode, X, Check} from 'lucide-react';

interface QuickOption {
  label: string;
  sublabel?: string;
  value: string;
}

interface QRScannerModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  placeholder?: string;
  quickOptions?: QuickOption[];
  onScan: (value: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {formats?: string[]}) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{rawValue: string}>>;
    };
  }
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  open,
  title,
  subtitle,
  placeholder = 'Ej. KXR-CAMPUS-CENTRAL o B-028',
  quickOptions = [],
  onScan,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;

    const startCamera = async () => {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Tu navegador no permite acceso directo a cámara aquí. Usa la selección rápida o ingresa el código.',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: 'environment'},
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
        }

        if (window.BarcodeDetector && videoRef.current) {
          const detector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39'],
          });
          const scanFrame = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0 && results[0].rawValue) {
                onScan(results[0].rawValue.trim());
                return;
              }
            } catch {
              // ignore frame read error
            }
            rafId = window.requestAnimationFrame(scanFrame);
          };
          rafId = window.requestAnimationFrame(scanFrame);
        }
      } catch {
        setCameraError(
          'No se pudo activar la cámara. Selecciona una opción directa o ingresa el código manualmente.',
        );
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      setCameraActive(false);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, onScan]);

  if (!open) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCode.trim();
    if (!cleaned) return;
    onScan(cleaned);
    setManualCode('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFEAFF] text-[#5B21B6]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#000000]">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-slate-600">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Cerrar escáner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl bg-[#000831] relative aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
          />
          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-[#109173] shadow-[0_0_0_9999px_rgba(0,8,49,0.45)]" />
            </div>
          )}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
              <Camera className="h-8 w-8 text-[#109173] mb-2" />
              <p className="text-sm font-medium">
                {cameraError || 'Activando cámara para escanear QR...'}
              </p>
            </div>
          )}
        </div>

        {quickOptions.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 mb-2.5">
              Escaneo directo disponible
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onScan(opt.value)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#109173]/30 bg-[#E6F7F3] px-3.5 py-3 text-left hover:bg-[#109173] hover:text-white transition-colors group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-[#000831] group-hover:text-white">
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div className="text-xs font-mono truncate text-slate-600 group-hover:text-white/85">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  <Check className="h-4 w-4 shrink-0 text-[#109173] group-hover:text-white" />
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleManualSubmit} className="mt-5 flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#000831] placeholder:text-slate-400 focus:border-[#109173] focus:outline-none focus:ring-2 focus:ring-[#109173]/20"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-[#109173] px-5 text-sm font-semibold text-white hover:bg-[#0B755C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Validar
          </button>
        </form>
      </div>
    </div>
  );
};
