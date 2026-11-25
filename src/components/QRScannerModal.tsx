import React, {useEffect, useRef, useState} from 'react';
import jsQR from 'jsqr';
import {Camera, Check, QrCode, X} from 'lucide-react';

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
  placeholder = 'Ej. KXR-1042 o B-028',
  quickOptions = [],
  onScan,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onScanRef = useRef(onScan);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    let stream: MediaStream | null = null;
    let rafId = 0;
    let cancelled = false;
    let detected = false;
    let lastDecodeTs = 0;

    const emitDecoded = (raw: string) => {
      const cleaned = raw.trim();
      if (!cleaned || detected || cancelled) return;
      detected = true;
      onScanRef.current(cleaned);
    };

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
          video: {facingMode: {ideal: 'environment'}},
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCameraActive(true);

        const detector = window.BarcodeDetector
          ? new window.BarcodeDetector({
              formats: ['qr_code', 'code_128', 'code_39'],
            })
          : null;

        const canvas = canvasRef.current || document.createElement('canvas');
        canvasRef.current = canvas;
        const ctx = canvas.getContext('2d', {willReadFrequently: true});

        const scanLoop = async (ts: number) => {
          if (cancelled || detected || !videoRef.current) return;

          if (
            ts - lastDecodeTs >= 140 &&
            videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA &&
            videoRef.current.videoWidth > 0 &&
            videoRef.current.videoHeight > 0
          ) {
            lastDecodeTs = ts;

            // 1) Try native BarcodeDetector first when supported
            if (detector) {
              try {
                const results = await detector.detect(videoRef.current);
                if (results.length > 0 && results[0].rawValue) {
                  emitDecoded(results[0].rawValue);
                  return;
                }
              } catch {
                // fall through to jsQR
              }
            }

            // 2) Universal jsQR frame decoding (works on iOS Safari, Firefox, Android, Desktop)
            if (ctx) {
              try {
                const vw = videoRef.current.videoWidth;
                const vh = videoRef.current.videoHeight;
                const maxDim = 640;
                const scale = Math.min(1, maxDim / Math.max(vw, vh));
                const w = Math.max(1, Math.floor(vw * scale));
                const h = Math.max(1, Math.floor(vh * scale));
                if (canvas.width !== w || canvas.height !== h) {
                  canvas.width = w;
                  canvas.height = h;
                }
                ctx.drawImage(videoRef.current, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const qr = jsQR(imgData.data, w, h, {
                  inversionAttempts: 'dontInvert',
                });
                if (qr?.data) {
                  emitDecoded(qr.data);
                  return;
                }
              } catch {
                // ignore transient frame read errors
              }
            }
          }

          if (!cancelled && !detected) {
            rafId = window.requestAnimationFrame(scanLoop);
          }
        };

        rafId = window.requestAnimationFrame(scanLoop);
      } catch {
        setCameraError(
          'No se pudo activar la cámara. Verifica permisos o ingresa el folio manualmente.',
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
  }, [open]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1E2A]/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCF61C] text-[#1A1E2A]">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#1A1E2A]">
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

        <div className="mt-5 overflow-hidden rounded-xl bg-[#1A1E2A] relative aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
          />
          {cameraActive && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-[#FCF61C] shadow-[0_0_0_9999px_rgba(26,30,42,0.45)]" />
              <span className="mt-3 rounded-lg bg-[#1A1E2A]/80 px-2.5 py-1 text-[11px] font-bold text-[#FCF61C]">
                Apunta al código QR del cliente o servicio
              </span>
            </div>
          )}
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
              <Camera className="h-8 w-8 text-[#FCF61C] mb-2" />
              <p className="text-sm font-medium">
                {cameraError || 'Activando cámara para escanear QR...'}
              </p>
            </div>
          )}
        </div>

        {quickOptions.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 mb-2.5">
              Acceso rápido a pedidos recientes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onScan(opt.value)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#8BAF03]/35 bg-[#F3F8DE] px-3.5 py-3 text-left hover:bg-[#8BAF03] transition-colors group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate text-[#1A1E2A]">
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div className="text-xs font-mono truncate text-slate-600 group-hover:text-[#1A1E2A]/85">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                  <Check className="h-4 w-4 shrink-0 text-[#5E7800] group-hover:text-[#1A1E2A]" />
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
            className="flex-1 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#1A1E2A] placeholder:text-slate-400 focus:border-[#8BAF03] focus:outline-none focus:ring-2 focus:ring-[#8BAF03]/20"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Validar
          </button>
        </form>
      </div>
    </div>
  );
};
