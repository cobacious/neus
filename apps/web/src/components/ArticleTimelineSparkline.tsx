import React, { useState, useReducer, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThreadColorStyle, DEFAULT_THREAD_COLOR } from '../utils/threadColors';
import { parseDate, formatRelativeTime } from '../utils/dateUtils';
import SourceFavicon from './SourceFavicon';

export interface TimelineArticle {
  id: string;
  title?: string | null;
  publishedAt?: string | number | null;
  source?: string | null;
  url?: string | null;
  sourceRel?: {
    id?: string;
    name?: string | null;
    faviconUrl?: string | null;
  } | null;
  threadId?: string | null;
  threadName?: string | null;
}

export interface TimelineMarker {
  id: string;
  pct: number;
  color: string;
  threadStyle: ThreadColorStyle;
  time: number;
  article: TimelineArticle;
}

export interface SparklineLayout {
  minTime: number;
  maxTime: number;
  spanMs: number;
  firstSeenLabel: string;
  lastUpdatedLabel: string;
  validArticles: (TimelineArticle & { time: number })[];
  markers: TimelineMarker[];
  // Backwards compatibility alias for tests
  markerGroups?: any[];
}

export type SparklineInteractionMode = 'idle' | 'hovering' | 'scrubbing' | 'latched';

export interface SparklineState {
  mode: SparklineInteractionMode;
  activeIndex: number | null;
}

export type SparklineAction =
  | { type: 'HOVER_ENTER'; index: number }
  | { type: 'HOVER_LEAVE' }
  | { type: 'SCRUB_START'; index: number }
  | { type: 'SCRUB_MOVE'; index: number }
  | { type: 'SCRUB_END' }
  | { type: 'LATCH'; index: number }
  | { type: 'STEP'; delta: number; maxIndex: number }
  | { type: 'KEY_NAV'; delta: number; maxIndex: number }
  | { type: 'DISMISS' };

export interface ArticleTimelineSparklineProps {
  articles?: TimelineArticle[];
  colorMap?: Map<string, ThreadColorStyle>;
  fallbackFirstSeen?: number | string | null;
  fallbackLastUpdated?: number | string | null;
  className?: string;
  storySlug?: string;
  onSelectArticle?: (article: TimelineArticle) => void;
}

/**
 * State machine reducer governing the 4 interaction modes:
 * idle, hovering, scrubbing and latched.
 */
export function sparklineStateReducer(
  state: SparklineState,
  action: SparklineAction
): SparklineState {
  switch (action.type) {
    case 'HOVER_ENTER':
      if (state.mode === 'scrubbing' || state.mode === 'latched') return state;
      return { mode: 'hovering', activeIndex: action.index };
    case 'HOVER_LEAVE':
      if (state.mode !== 'hovering') return state;
      return { mode: 'idle', activeIndex: null };
    case 'SCRUB_START':
      return { mode: 'scrubbing', activeIndex: action.index };
    case 'SCRUB_MOVE':
      if (state.mode !== 'scrubbing') return state;
      return { mode: 'scrubbing', activeIndex: action.index };
    case 'SCRUB_END':
      if (state.mode !== 'scrubbing') return state;
      return { mode: 'latched', activeIndex: state.activeIndex };
    case 'LATCH':
      return { mode: 'latched', activeIndex: action.index };
    case 'STEP': {
      if (state.activeIndex === null) return state;
      const nextIndex = Math.max(0, Math.min(action.maxIndex, state.activeIndex + action.delta));
      return { mode: 'latched', activeIndex: nextIndex };
    }
    case 'KEY_NAV': {
      const currentIndex = state.activeIndex ?? (action.delta > 0 ? -1 : action.maxIndex + 1);
      const nextIndex = Math.max(0, Math.min(action.maxIndex, currentIndex + action.delta));
      return { mode: 'latched', activeIndex: nextIndex };
    }
    case 'DISMISS':
      return { mode: 'idle', activeIndex: null };
    default:
      return state;
  }
}

/**
 * Resolves the marker whose physical position along the track is closest to clientX.
 * Used for high-precision desktop mouse hover so hovering over or near a dot always
 * selects that specific marker without any virtual displacement.
 */
export function resolveNearestMarkerIndex(
  clientX: number,
  rect: { left: number; width: number },
  markers: TimelineMarker[]
): number | null {
  if (!markers || markers.length === 0) return null;
  if (markers.length === 1) return 0;
  const W = rect.width;
  if (W <= 0) return 0;

  const pX = Math.max(0, Math.min(W, clientX - rect.left));
  let closestIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < markers.length; i++) {
    const physX = (markers[i].pct / 100) * W;
    const dist = Math.abs(physX - pX);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Cluster-aware scrub resolution:
 * Resolves the marker index corresponding to clientX within rect.
 * Preserves solitary markers at their exact physical positions while expanding
 * tight clusters (where adjacent markers have gap < 12px) so touch scrubbing with
 * a thumb cleanly isolates each overlapping marker in chronological order.
 */
export function resolveScrubIndex(
  clientX: number,
  rect: { left: number; width: number },
  markers: TimelineMarker[]
): number | null {
  if (!markers || markers.length === 0) return null;
  if (markers.length === 1) return 0;
  const N = markers.length;
  const W = rect.width;
  if (W <= 0) return 0;

  const rawCenters = markers.map((m) => (m.pct / 100) * W);
  const pX = Math.max(0, Math.min(W, clientX - rect.left));

  // Identify clusters where adjacent markers have physical distance < 12px
  const clusters: number[][] = [];
  let currentCluster: number[] = [0];

  for (let i = 1; i < N; i++) {
    if (rawCenters[i] - rawCenters[i - 1] < 12) {
      currentCluster.push(i);
    } else {
      clusters.push(currentCluster);
      currentCluster = [i];
    }
  }
  clusters.push(currentCluster);

  // Compute virtual centers
  const virtualCenters = new Array<number>(N);

  for (let c = 0; c < clusters.length; c++) {
    const indices = clusters[c];
    if (indices.length === 1) {
      virtualCenters[indices[0]] = rawCenters[indices[0]];
    } else {
      const K = indices.length;
      const prevX = c > 0 ? rawCenters[clusters[c - 1][clusters[c - 1].length - 1]] : 0;
      const nextX = c < clusters.length - 1 ? rawCenters[clusters[c + 1][0]] : W;

      const availableSpace = Math.max(1, nextX - prevX);
      const spacing = Math.min(14, availableSpace / (K + 1));
      const meanX = indices.reduce((sum, idx) => sum + rawCenters[idx], 0) / K;
      const clusterSpan = (K - 1) * spacing;
      let startX = meanX - clusterSpan / 2;

      if (startX < prevX + spacing / 2) startX = prevX + spacing / 2;
      if (startX + clusterSpan > nextX - spacing / 2) startX = nextX - spacing / 2 - clusterSpan;

      for (let k = 0; k < K; k++) {
        virtualCenters[indices[k]] = startX + k * spacing;
      }
    }
  }

  // Find nearest virtual center to pX
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < N; i++) {
    const dist = Math.abs(virtualCenters[i] - pX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Builds the canonical deep link URL for an article from a feed card sparkline.
 * Format: /${storySlug}?thread=${threadId}#article-${articleId}
 */
export function buildArticleDeepLinkUrl(storySlug: string, article: TimelineArticle): string {
  const base = storySlug.startsWith('/') ? storySlug : `/${storySlug}`;
  const threadParam = article.threadId ? `?thread=${encodeURIComponent(article.threadId)}` : '';
  return `${base}${threadParam}#article-${encodeURIComponent(article.id)}`;
}

/**
 * Calculates a clamped horizontal pixel offset for the floating tooltip relative to
 * the sparkline container so the tooltip always remains fully within container bounds
 * with safety padding. This eliminates horizontal document overflow and prevents
 * scrollbar flickering on mobile.
 */
export function calculateClampedTooltipLeft({
  containerWidth,
  trackLeft,
  trackWidth,
  markerPct,
  tooltipWidth = 256,
  padding = 8,
}: {
  containerWidth: number;
  trackLeft: number;
  trackWidth: number;
  markerPct: number;
  tooltipWidth?: number;
  padding?: number;
}): number {
  if (containerWidth <= 0) return padding;

  const markerX = trackLeft + (markerPct / 100) * trackWidth;
  const effectiveTooltipWidth = Math.min(tooltipWidth, Math.max(0, containerWidth - padding * 2));
  const idealLeft = markerX - effectiveTooltipWidth / 2;
  const minLeft = padding;
  const maxLeft = Math.max(minLeft, containerWidth - effectiveTooltipWidth - padding);

  return Math.max(minLeft, Math.min(idealLeft, maxLeft));
}

/**
 * Computes timeline markers along a clean, flat single horizontal rail.
 * - Every article has its own individual dot on the rail.
 * - Every dot strictly displays its thread palette color.
 * - First seen is anchored at 0%, last updated is anchored at 100%.
 */
export function buildTimelineMarkers(
  articles: TimelineArticle[] = [],
  options?: {
    colorMap?: Map<string, ThreadColorStyle>;
    fallbackFirstSeen?: number | string | null;
    fallbackLastUpdated?: number | string | null;
  }
): SparklineLayout | null {
  const { colorMap, fallbackFirstSeen, fallbackLastUpdated } = options || {};

  // 1. Extract valid timestamps safely via parseDate
  const validArticles = articles
    .map((a) => {
      const parsed = parseDate(a.publishedAt);
      const time = parsed ? parsed.getTime() : NaN;
      return { ...a, time };
    })
    .filter((a) => !isNaN(a.time))
    .sort((a, b) => a.time - b.time);

  // 2. Determine timeline bounds
  const parsedFallbackFirst = parseDate(fallbackFirstSeen);
  const parsedFallbackLast = parseDate(fallbackLastUpdated);

  let minTime = validArticles.length > 0 ? validArticles[0].time : NaN;
  let maxTime = validArticles.length > 0 ? validArticles[validArticles.length - 1].time : NaN;

  if (isNaN(minTime) && parsedFallbackFirst) {
    minTime = parsedFallbackFirst.getTime();
  }
  if (isNaN(maxTime) && parsedFallbackLast) {
    maxTime = parsedFallbackLast.getTime();
  }

  // If still missing bounds, fallback mutually
  if (isNaN(minTime) && !isNaN(maxTime)) minTime = maxTime;
  if (isNaN(maxTime) && !isNaN(minTime)) maxTime = minTime;

  if (isNaN(minTime) || isNaN(maxTime)) {
    return null;
  }

  const spanMs = maxTime - minTime;
  const firstSeenLabel = formatRelativeTime(minTime);
  const lastUpdatedLabel = formatRelativeTime(maxTime);

  // 3. Compute markers anchored at 0% and 100%
  const markers: TimelineMarker[] = validArticles.map((article, index) => {
    const isFirstArticle = index === 0;
    const isLastArticle = index === validArticles.length - 1;
    const rawPct = spanMs > 0 ? ((article.time - minTime) / spanMs) * 100 : 100;
    const pct =
      isFirstArticle && spanMs > 0
        ? 0
        : isLastArticle && spanMs > 0
        ? 100
        : Math.max(0, Math.min(100, rawPct));

    const threadStyle =
      (article.threadId && colorMap?.get(article.threadId)) ||
      (article.threadName && colorMap?.get(article.threadName)) ||
      DEFAULT_THREAD_COLOR;

    return {
      id: article.id,
      pct,
      color: threadStyle.color,
      threadStyle,
      time: article.time,
      article,
    };
  });

  return {
    minTime,
    maxTime,
    spanMs,
    firstSeenLabel,
    lastUpdatedLabel,
    validArticles,
    markers,
    markerGroups: markers.map((m) => ({ ...m, articles: [m.article] })),
  };
}

export const buildMarkerGroups = buildTimelineMarkers;

export default function ArticleTimelineSparkline({
  articles = [],
  colorMap,
  fallbackFirstSeen,
  fallbackLastUpdated,
  className = '',
  storySlug,
  onSelectArticle,
}: ArticleTimelineSparklineProps) {
  const [state, dispatch] = useReducer(sparklineStateReducer, {
    mode: 'idle',
    activeIndex: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cachedRectRef = useRef<{ left: number; width: number } | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  let routerNavigate: ReturnType<typeof useNavigate> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    routerNavigate = useNavigate();
  } catch {
    routerNavigate = null;
  }

  const layout = useMemo(
    () =>
      buildTimelineMarkers(articles, {
        colorMap,
        fallbackFirstSeen,
        fallbackLastUpdated,
      }),
    [articles, colorMap, fallbackFirstSeen, fallbackLastUpdated]
  );

  // Outside pointer down, window scroll and escape dismissal when latched
  useEffect(() => {
    if (state.mode !== 'latched') return;

    const handleOutsidePointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'DISMISS' });
      }
    };

    const handleWindowScroll = () => {
      dispatch({ type: 'DISMISS' });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'DISMISS' });
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.mode]);

  // Clean up grace timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  // Re-render listener when window resizes so latched tooltips update layout bounds
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const handleResize = () => {
      setResizeTick((t) => t + 1);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!layout) {
    return null;
  }

  const { firstSeenLabel, lastUpdatedLabel, validArticles, markers } = layout;
  const activeMarker =
    state.activeIndex !== null && state.activeIndex >= 0 && state.activeIndex < markers.length
      ? markers[state.activeIndex]
      : null;

  const handleArticleNavigate = (article: TimelineArticle) => {
    dispatch({ type: 'DISMISS' });

    if (onSelectArticle) {
      onSelectArticle(article);
      return;
    }

    if (storySlug) {
      const targetUrl = buildArticleDeepLinkUrl(storySlug, article);
      if (routerNavigate) {
        routerNavigate(targetUrl);
      } else if (typeof window !== 'undefined') {
        window.location.assign(targetUrl);
      }
    }
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    cachedRectRef.current = { left: rect.left, width: rect.width };

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      const index = resolveScrubIndex(e.clientX, cachedRectRef.current, markers);
      if (index === null) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture failure on unsupported environments
      }
      dispatch({ type: 'SCRUB_START', index });
    } else {
      // Desktop mouse click: resolve nearest physical marker and latch
      const index = resolveNearestMarkerIndex(e.clientX, cachedRectRef.current, markers);
      if (index !== null) {
        dispatch({ type: 'LATCH', index });
      }
    }
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state.mode === 'scrubbing') {
      e.stopPropagation();
      const rect = cachedRectRef.current || trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const index = resolveScrubIndex(e.clientX, rect, markers);
      if (index !== null && index !== state.activeIndex) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(4);
          } catch {
            // Ignore vibration restriction
          }
        }
        dispatch({ type: 'SCRUB_MOVE', index });
      }
    } else if (e.pointerType === 'mouse' && state.mode !== 'latched') {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      // On desktop, find physically closest marker to the cursor along the rail
      const index = resolveNearestMarkerIndex(e.clientX, rect, markers);
      if (index !== null) {
        dispatch({ type: 'HOVER_ENTER', index });
      }
    }
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state.mode === 'scrubbing') {
      e.stopPropagation();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      cachedRectRef.current = null;
      dispatch({ type: 'SCRUB_END' });
    }
  };

  const handleTrackPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state.mode === 'scrubbing') {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      cachedRectRef.current = null;
      dispatch({ type: 'SCRUB_END' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (markers.length === 0) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: 'KEY_NAV', delta: 1, maxIndex: markers.length - 1 });
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: 'KEY_NAV', delta: -1, maxIndex: markers.length - 1 });
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (activeMarker) {
        e.preventDefault();
        e.stopPropagation();
        handleArticleNavigate(activeMarker.article);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: 'DISMISS' });
    }
  };

  const isElevated = state.mode === 'scrubbing' || state.mode === 'latched';
  const showTooltip = Boolean(activeMarker && state.mode !== 'idle');

  let tooltipLeft = 8;
  if (activeMarker && containerRef.current && trackRef.current) {
    const cRect = containerRef.current.getBoundingClientRect();
    const tRect = trackRef.current.getBoundingClientRect();
    if (cRect.width > 0) {
      tooltipLeft = calculateClampedTooltipLeft({
        containerWidth: cRect.width,
        trackLeft: tRect.left - cRect.left,
        trackWidth: tRect.width,
        markerPct: activeMarker.pct,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative py-1.5 pointer-events-auto ${className}`}
      role="region"
      aria-label={`Article timeline from ${firstSeenLabel} to ${lastUpdatedLabel} with ${validArticles.length} articles`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        {/* Left: First seen */}
        <span
          className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap select-none"
          title={`First seen: ${firstSeenLabel}`}
        >
          {firstSeenLabel}
        </span>

        {/* Central rail track hit envelope (44px vertical touch target) */}
        <div
          ref={trackRef}
          className="relative flex-1 min-h-[44px] flex items-center select-none touch-none cursor-pointer mx-1 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded-sm"
          style={{
            WebkitUserSelect: 'none',
            userSelect: 'none',
            touchAction: 'none',
          }}
          tabIndex={0}
          role="slider"
          aria-label="Article timeline track. Slide or use arrow keys to inspect articles."
          aria-valuemin={1}
          aria-valuemax={markers.length}
          aria-valuenow={state.activeIndex !== null ? state.activeIndex + 1 : undefined}
          aria-valuetext={
            activeMarker
              ? `${activeMarker.article.title || 'Article'} (${formatRelativeTime(activeMarker.time)})`
              : undefined
          }
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={handleTrackPointerUp}
          onPointerCancel={handleTrackPointerCancel}
          onLostPointerCapture={() => {
            if (state.mode === 'scrubbing') {
              cachedRectRef.current = null;
              dispatch({ type: 'SCRUB_END' });
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse' && state.mode === 'hovering') {
              leaveTimeoutRef.current = setTimeout(() => {
                dispatch({ type: 'HOVER_LEAVE' });
              }, 150);
            }
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Visual rail line */}
          <div className="w-full h-[3px] bg-gray-200 rounded-full relative pointer-events-none">
            {/* Subtle rail anchor terminals at both ends */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-300 pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-300 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Vertical hairline guide when scrubbing or latched */}
          {activeMarker && (state.mode === 'scrubbing' || state.mode === 'latched') && (
            <div
              className="absolute w-px bg-slate-400/50 -translate-x-1/2 pointer-events-none transition-all duration-75 z-20"
              style={{
                left: `${activeMarker.pct}%`,
                top: '0px',
                height: '22px',
              }}
              aria-hidden="true"
            />
          )}

          {/* Interactive timeline markers on rail */}
          {markers.map((marker, index) => {
            const isActive = state.activeIndex === index && state.mode !== 'idle';

            return (
              <button
                key={marker.id}
                type="button"
                tabIndex={-1}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-2 focus:outline-none rounded-full transition-transform duration-150 cursor-pointer"
                style={{
                  left: `${marker.pct}%`,
                  transform: `translate(-50%, -50%) ${isActive ? 'scale(1.5)' : 'scale(1)'}`,
                  zIndex: isActive ? 25 : 10,
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') {
                    e.stopPropagation();
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'LATCH', index });
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') {
                    e.stopPropagation();
                    if (leaveTimeoutRef.current) {
                      clearTimeout(leaveTimeoutRef.current);
                      leaveTimeoutRef.current = null;
                    }
                    dispatch({ type: 'HOVER_ENTER', index });
                  }
                }}
                onPointerMove={(e) => {
                  if (e.pointerType === 'mouse') {
                    e.stopPropagation();
                    if (state.activeIndex !== index && state.mode !== 'latched') {
                      dispatch({ type: 'HOVER_ENTER', index });
                    }
                  }
                }}
                aria-label={`${marker.article.title || 'Article'} (${formatRelativeTime(marker.time)})`}
              >
                <span
                  className="block w-2.5 h-2.5 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: marker.color,
                    boxShadow: isActive
                      ? `0 0 0 2px #ffffff, 0 0 0 4px ${marker.color}`
                      : '0 0 0 1px #ffffff, 0 1px 2px rgba(0, 0, 0, 0.2)',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Last updated */}
        <span
          className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap select-none"
          title={`Last updated: ${lastUpdatedLabel}`}
        >
          {lastUpdatedLabel}
        </span>
      </div>

      {/* Floating Actionable Tooltip */}
      {showTooltip && activeMarker && (
        <div
          className={`absolute z-30 bg-slate-900 text-white rounded-md p-3 text-xs shadow-xl w-64 max-w-[calc(100%-16px)] border border-slate-800 cursor-pointer group select-none ${
            state.mode === 'scrubbing' ? 'transition-none' : 'transition-all duration-150'
          }`}
          style={{
            bottom: isElevated ? 'calc(100% + 16px)' : 'calc(100% + 8px)',
            left: `${tooltipLeft}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleArticleNavigate(activeMarker.article);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleArticleNavigate(activeMarker.article);
            }
          }}
          onPointerEnter={() => {
            if (leaveTimeoutRef.current) {
              clearTimeout(leaveTimeoutRef.current);
              leaveTimeoutRef.current = null;
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse' && state.mode === 'hovering') {
              leaveTimeoutRef.current = setTimeout(() => {
                dispatch({ type: 'HOVER_LEAVE' });
              }, 150);
            }
          }}
        >
          {/* Header: Source favicon, name, relative time and stepper */}
          <div className="flex items-center justify-between gap-1.5 mb-1.5 text-[10px] text-gray-300">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <SourceFavicon
                source={activeMarker.article.sourceRel || { name: activeMarker.article.source }}
                className="w-3.5 h-3.5 rounded-xs shrink-0"
              />
              <span className="font-semibold text-gray-200 truncate">
                {activeMarker.article.sourceRel?.name ||
                  activeMarker.article.source ||
                  'News Source'}
              </span>
              <span>•</span>
              <span className="shrink-0">{formatRelativeTime(activeMarker.time)}</span>
            </div>

            {/* Stepper / Counter */}
            {markers.length > 1 && (
              <div className="flex items-center gap-1 font-mono text-[10px] text-gray-400 shrink-0 ml-auto h-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'STEP', delta: -1, maxIndex: markers.length - 1 });
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate(4);
                      } catch {
                        // Ignore vibration restriction
                      }
                    }
                  }}
                  disabled={state.activeIndex === 0}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 active:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer text-gray-300"
                  aria-label="Previous article"
                  title="Previous article"
                >
                  ‹
                </button>
                <span className="px-0.5 select-none font-sans">
                  {(state.activeIndex ?? 0) + 1}/{markers.length}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'STEP', delta: 1, maxIndex: markers.length - 1 });
                    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate(4);
                      } catch {
                        // Ignore vibration restriction
                      }
                    }
                  }}
                  disabled={state.activeIndex === markers.length - 1}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 active:bg-slate-700 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer text-gray-300"
                  aria-label="Next article"
                  title="Next article"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* Thread Tag Pill */}
          {activeMarker.article.threadName && (
            <div className="mb-1.5">
              <span
                className="inline-block px-1.5 py-0.5 rounded-xs text-[9px] font-semibold border uppercase tracking-wider"
                style={{
                  backgroundColor: activeMarker.threadStyle.bg,
                  borderColor: activeMarker.threadStyle.border,
                  color: activeMarker.threadStyle.text,
                }}
              >
                {activeMarker.article.threadName}
              </span>
            </div>
          )}

          {/* Headline + Right Chevron */}
          <div className="flex items-start justify-between gap-2 mt-1">
            <div className="line-clamp-2 text-[11px] text-gray-100 font-sans leading-relaxed group-hover:text-white transition-colors text-left flex-1">
              {activeMarker.article.title || 'Untitled Article'}
            </div>
            <span
              className="text-gray-400 group-hover:text-white transition-colors text-sm shrink-0 font-bold self-center"
              aria-hidden="true"
            >
              ›
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
