import { useState, useEffect, useRef, useCallback } from 'react';

export type RefreshStatus = 'idle' | 'pulling' | 'can-release' | 'refreshing' | 'success' | 'error';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<boolean | void> | boolean | void;
  threshold?: number;
  maxPull?: number;
  resistance?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 60,
  maxPull = 95,
  resistance = 0.42,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<RefreshStatus>('idle');
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const updateDistance = (dist: number) => {
    pullDistanceRef.current = dist;
    setPullDistance(dist);
  };

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || status === 'refreshing') return;
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
        setIsPulling(true);
      }
    },
    [disabled, status]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPullingRef.current || status === 'refreshing' || disabled) return;

      if (window.scrollY > 0) {
        isPullingRef.current = false;
        setIsPulling(false);
        updateDistance(0);
        setStatus('idle');
        return;
      }

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      if (deltaY > 0) {
        const damped = Math.min(maxPull, deltaY * resistance);
        updateDistance(damped);

        if (damped >= threshold) {
          setStatus('can-release');
        } else {
          setStatus('pulling');
        }
      } else {
        updateDistance(0);
        setStatus('idle');
      }
    },
    [disabled, maxPull, resistance, status, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    setIsPulling(false);

    if (pullDistanceRef.current >= threshold && status !== 'refreshing' && !disabled) {
      setStatus('refreshing');
      updateDistance(56); // Rest position during refresh (balanced 24px above and below)

      try {
        const result = await onRefresh();
        // Show confirmation state briefly
        setStatus(result === false ? 'error' : 'success');
        await new Promise((resolve) => setTimeout(resolve, 750));
      } catch (_) {
        setStatus('error');
        await new Promise((resolve) => setTimeout(resolve, 850));
      } finally {
        updateDistance(0);
        // Wait for slide-back transition to complete before unmounting indicator
        await new Promise((resolve) => setTimeout(resolve, 350));
        setStatus('idle');
      }
    } else {
      updateDistance(0);
      setStatus('idle');
    }
  }, [disabled, onRefresh, status, threshold]);

  const handleTouchCancel = useCallback(() => {
    isPullingRef.current = false;
    setIsPulling(false);
    updateDistance(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || disabled) return;

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  const isRefreshing = status === 'refreshing' || status === 'success' || status === 'error';

  return {
    pullDistance,
    status,
    isPulling,
    isRefreshing,
    threshold,
    contentStyle: {
      transform: pullDistance > 0 ? `translate3d(0, ${pullDistance}px, 0)` : undefined,
      transition: isPulling ? 'none' : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
      willChange: isPulling ? 'transform' : undefined,
    },
  };
}
