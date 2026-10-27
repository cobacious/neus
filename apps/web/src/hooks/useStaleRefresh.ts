import { useEffect, useRef, useCallback } from 'react';

export interface UseStaleRefreshOptions {
  onRefresh: () => void;
  staleDurationMs?: number;
  disabled?: boolean;
}

export function useStaleRefresh({
  onRefresh,
  staleDurationMs = 5 * 60 * 1000, // 5 minutes
  disabled = false,
}: UseStaleRefreshOptions) {
  const lastFetchedRef = useRef(Date.now());

  const markFresh = useCallback(() => {
    lastFetchedRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || disabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchedRef.current;
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        if (elapsed >= staleDurationMs && isOnline) {
          lastFetchedRef.current = Date.now();
          onRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disabled, onRefresh, staleDurationMs]);

  return { markFresh };
}
