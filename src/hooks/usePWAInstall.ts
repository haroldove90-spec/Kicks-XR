import {useEffect, useState} from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

declare global {
  interface Window {
    __kicksxrDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

// Module-level singleton so deferredPrompt survives route changes and component remounts
let sharedPrompt: BeforeInstallPromptEvent | null = null;
let sharedInstalled = false;
const listeners = new Set<() => void>();
let globalListenersAttached = false;

function notifyAll() {
  listeners.forEach((fn) => fn());
}

function attachGlobalInstallListeners() {
  if (typeof window === 'undefined' || globalListenersAttached) return;
  globalListenersAttached = true;

  if (window.__kicksxrDeferredPrompt) {
    sharedPrompt = window.__kicksxrDeferredPrompt;
  }

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as {standalone?: boolean}).standalone === true;
  if (standalone) {
    sharedInstalled = true;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    const promptEv = e as BeforeInstallPromptEvent;
    window.__kicksxrDeferredPrompt = promptEv;
    sharedPrompt = promptEv;
    notifyAll();
  });

  window.addEventListener('kicksxr-install-prompt-ready', () => {
    if (window.__kicksxrDeferredPrompt) {
      sharedPrompt = window.__kicksxrDeferredPrompt;
      notifyAll();
    }
  });

  const handleInstalled = () => {
    sharedInstalled = true;
    sharedPrompt = null;
    window.__kicksxrDeferredPrompt = null;
    notifyAll();
  };

  window.addEventListener('appinstalled', handleInstalled);
  window.addEventListener('kicksxr-app-installed', handleInstalled);
}

export function usePWAInstall() {
  const [, forceUpdate] = useState(0);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    attachGlobalInstallListeners();

    const ua = window.navigator.userAgent.toLowerCase();
    setIsAndroid(/android/.test(ua));
    setIsIOS(
      /iphone|ipad|ipod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    );
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    // Sync immediately in case global prompt was captured before mount
    listener();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const deferredPrompt =
    sharedPrompt ||
    (typeof window !== 'undefined' ? window.__kicksxrDeferredPrompt || null : null);

  const install = async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    const promptEvent =
      sharedPrompt ||
      (typeof window !== 'undefined' ? window.__kicksxrDeferredPrompt || null : null);

    if (!promptEvent) return 'manual';

    try {
      await promptEvent.prompt();
      const {outcome} = await promptEvent.userChoice;
      sharedPrompt = null;
      if (typeof window !== 'undefined') {
        window.__kicksxrDeferredPrompt = null;
      }
      if (outcome === 'accepted') {
        sharedInstalled = true;
        notifyAll();
        return 'accepted';
      }
      notifyAll();
      return 'dismissed';
    } catch {
      return 'manual';
    }
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled: sharedInstalled,
    isAndroid,
    isIOS,
    isInIframe,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
