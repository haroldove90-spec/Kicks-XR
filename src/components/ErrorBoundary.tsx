import React from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';
import {BrandLogo} from './BrandLogo';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, errorMessage: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error?.message || 'Ocurrió un error inesperado al cargar la interfaz.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Kicks XR UI error:', error);
  }

  handleRecover = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore cache cleanup failures
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 text-center shadow-xs space-y-5">
          <div className="flex justify-center">
            <BrandLogo className="h-10 w-auto object-contain" />
          </div>

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-extrabold text-[#1A1E2A]">
              No se pudo mostrar esta vista
            </h1>
            <p className="text-sm text-slate-600">
              Detectamos un problema temporal al cargar el sistema. Pulsa el botón para limpiar caché y recargar Kicks XR.
            </p>
            {this.state.errorMessage && (
              <p className="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600 break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={this.handleRecover}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8BAF03] px-5 text-sm font-bold text-[#1A1E2A] hover:bg-[#749402] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Limpiar caché y recargar</span>
          </button>
        </div>
      </div>
    );
  }
}
