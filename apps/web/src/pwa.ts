import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global deferred prompt holder
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(canInstall: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((listener) => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((listener) => listener(false));
  });
}

/**
 * Registers the service worker in production and browser environments.
 */
export function registerServiceWorker() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    import.meta.env.DEV
  ) {
    return;
  }

  // Register once page loads for non-blocking initial rendering
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Automatically check for service worker updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New content available
                console.info('[Neus PWA] New version available; will activate on next visit.');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('[Neus PWA] Service worker registration failed:', error);
      });
  });
}

/**
 * Detects whether the web app is running in standalone PWA mode
 * (installed to Home Screen on iOS, Android or Desktop).
 * Also supports `?pwa=1` for testing in standard browser tabs.
 */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    new URLSearchParams(window.location.search).has('pwa')
  );
}

/**
 * React hook to manage PWA installation affordances.
 */
export function usePwaInstall() {
  const [isInstallable, setIsInstallable] = useState<boolean>(Boolean(deferredPrompt));
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalonePwa());

  useEffect(() => {
    const handleUpdate = (canInstall: boolean) => {
      setIsInstallable(canInstall);
    };

    listeners.add(handleUpdate);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      listeners.delete(handleUpdate);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setIsInstallable(false);
    return outcome === 'accepted';
  };

  return { isInstallable, isInstalled, promptInstall };
}

/**
 * React hook to monitor network connectivity status.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
