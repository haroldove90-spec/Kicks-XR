import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Camera,
  Check,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';

interface CameraCaptureModalProps {
  open: boolean;
  onCapture: (dataUrl: string) => void;
  onFallbackGallery: () => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  onCapture,
  onFallbackGallery,
  onClose,
  title = 'Cámara del dispositivo',
  subtitle = 'Toma la fotografía de evidencia inicial de tus tenis',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      setPreviewUrl(null);
      setErrorMsg(null);
      setStatus('requesting');

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('denied');
        setErrorMsg(
          'Tu navegador no permite abrir la cámara en directo aquí. Puedes seleccionar una foto desde tu galería o cámara nativa.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {ideal: mode},
            width: {ideal: 1280},
            height: {ideal: 960},
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch {
        setStatus('denied');
        setErrorMsg(
          'Permiso de cámara bloqueado o no disponible. Acepta el permiso de cámara en tu dispositivo o sube la foto desde tu galería.',
        );
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopStream();
      setPreviewUrl(null);
      setStatus('idle');
    }
    return () => {
      stopStream();
    };
  }, [open, facingMode, startCamera, stopStream]);

  if (!open) return null;

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const maxSide = 960;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxSide || height > maxSide) {
      if (width > height) {
        height = Math.round((height * maxSide) / width);
        width = maxSide;
      } else {
        width = Math.round((width * maxSide) / height);
        height = maxSide;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setPreviewUrl(dataUrl);
    stopStream();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000831]/80 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F7F3] text-[#109173]">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold text-[#000000]">
                {title}
              </h3>
              <p className="text-xs text-slate-600">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
            aria-label="Cerrar cámara"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-[#000831] relative aspect-[4/3] flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Vista previa capturada"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                className={`h-full w-full object-cover ${
                  status === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {status === 'requesting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                  <Camera className="h-9 w-9 text-[#109173] animate-pulse mb-2" />
                  <p className="text-sm font-semibold">
                    Solicitando permiso de cámara al dispositivo...
                  </p>
                  <p className="mt-1 text-xs text-white/75">
                    Pulsa “Permitir” en el aviso de tu teléfono o navegador.
                  </p>
                </div>
              )}
              {status === 'denied' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                  <ShieldAlert className="h-9 w-9 text-amber-400 mb-2" />
                  <p className="text-sm font-semibold">Permiso de cámara requerido</p>
                  <p className="mt-1.5 text-xs text-white/80 max-w-sm">
                    {errorMsg}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#000831] hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Tomar otra</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onCapture(previewUrl);
                  onClose();
                }}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-4 text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Usar fotografía</span>
              </button>
            </>
          ) : status === 'ready' ? (
            <>
              <button
                type="button"
                onClick={() =>
                  setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                }
                className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-[#000831] hover:bg-slate-50 cursor-pointer"
                title="Cambiar cámara frontal / trasera"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Voltear</span>
              </button>
              <button
                type="button"
                onClick={handleTakePhoto}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-5 text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>Tomar fotografía</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-[#000831] hover:bg-slate-50 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                <span>Reintentar permiso</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackGallery();
                }}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#109173] px-4 text-sm font-bold text-white hover:bg-[#0B755C] cursor-pointer"
              >
                <ImageIcon className="h-4 w-4" />
                <span>Subir de galería</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
