import { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  resistance?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 65,
  maxPull = 100,
  resistance = 0.45,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const updateDistance = (dist: number) => {
    pullDistanceRef.current = dist;
    setPullDistance(dist);
  };

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (window.scrollY <= 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing || disabled) return;

      if (window.scrollY > 0) {
        isPullingRef.current = false;
        updateDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      if (deltaY > 0) {
        const damped = Math.min(maxPull, deltaY * resistance);
        updateDistance(damped);
      } else {
        updateDistance(0);
      }
    },
    [disabled, isRefreshing, maxPull, resistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistanceRef.current >= threshold && !isRefreshing && !disabled) {
      setIsRefreshing(true);
      updateDistance(threshold);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        updateDistance(0);
      }
    } else {
      updateDistance(0);
    }
  }, [disabled, isRefreshing, onRefresh, threshold]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const endRefresh = useCallback(() => {
    setIsRefreshing(false);
    updateDistance(0);
  }, []);

  return {
    pullDistance,
    isRefreshing,
    threshold,
    endRefresh,
  };
}
