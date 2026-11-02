import React, { useReducer, useMemo, useRef, useEffect } from 'react';
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
 * Cluster-aware scrub resolution:
 * Resolves the marker index corresponding to clientX within rect.
 * For overlapping or densely clustered markers, iterative relaxation guarantees
 * a minimum hit target separation (minSpacing) so thumb movement cleanly isolates
 * each marker without adjacent dots being skipped.
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

  const minSpacing = Math.min(12, W / N);
  const rawCenters = markers.map((m) => (m.pct / 100) * W);
  const centers = [...rawCenters];

  // Iterative relaxation to guarantee minimum virtual separation between markers
  for (let iter = 0; iter < 20; iter++) {
    let adjusted = false;
    for (let i = 0; i < N - 1; i++) {
      const gap = centers[i + 1] - centers[i];
      if (gap < minSpacing) {
        adjusted = true;
        const deficit = (minSpacing - gap) / 2;
        centers[i] -= deficit;
        centers[i + 1] += deficit;
      }
    }
    if (centers[0] < 0) {
      const shift = -centers[0];
      for (let i = 0; i < N; i++) centers[i] += shift;
    }
    if (centers[N - 1] > W) {
      const shift = centers[N - 1] - W;
      for (let i = 0; i < N; i++) centers[i] -= shift;
    }
    if (!adjusted) break;
  }

  const pX = Math.max(0, Math.min(W, clientX - rect.left));

  // Determine virtual boundaries between adjacent markers
  const boundaries: number[] = [0];
  for (let i = 1; i < N; i++) {
    boundaries.push((centers[i - 1] + centers[i]) / 2);
  }
  boundaries.push(W);

  for (let i = 0; i < N; i++) {
    if (pX >= boundaries[i] && pX <= boundaries[i + 1]) {
      return i;
    }
  }
  return N - 1;
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

    const index = resolveScrubIndex(e.clientX, cachedRectRef.current, markers);
    if (index === null) return;

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture failure on unsupported environments
      }
      dispatch({ type: 'SCRUB_START', index });
    } else {
      dispatch({ type: 'HOVER_ENTER', index });
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
      const index = resolveScrubIndex(e.clientX, rect, markers);
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
          className="relative flex-1 min-h-[44px] flex items-center select-none touch-pan-y cursor-pointer mx-1 focus:outline-none focus:ring-1 focus:ring-slate-400 rounded-sm"
          style={{
            WebkitUserSelect: 'none',
            userSelect: 'none',
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (state.mode === 'latched' && state.activeIndex === index) {
                    handleArticleNavigate(marker.article);
                  } else {
                    dispatch({ type: 'SCRUB_START', index });
                    dispatch({ type: 'SCRUB_END' });
                  }
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') {
                    if (leaveTimeoutRef.current) {
                      clearTimeout(leaveTimeoutRef.current);
                      leaveTimeoutRef.current = null;
                    }
                    dispatch({ type: 'HOVER_ENTER', index });
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
          className={`absolute z-30 bg-slate-900 text-white rounded-md p-3 text-xs shadow-xl w-64 max-w-[calc(100vw-32px)] border border-slate-800 cursor-pointer group select-none transition-all duration-150 ${
            activeMarker.pct < 20
              ? 'left-0 translate-x-0'
              : activeMarker.pct > 80
              ? 'left-full -translate-x-full'
              : '-translate-x-1/2'
          }`}
          style={{
            bottom: isElevated ? 'calc(100% + 16px)' : 'calc(100% + 8px)',
            left:
              activeMarker.pct >= 20 && activeMarker.pct <= 80
                ? `${activeMarker.pct}%`
                : undefined,
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
              <div className="flex items-center gap-1 font-mono text-[10px] text-gray-400 shrink-0 ml-auto">
                {state.mode === 'latched' ? (
                  <>
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
                  </>
                ) : (
                  <span className="text-[10px] text-gray-400 select-none">
                    {(state.activeIndex ?? 0) + 1} of {markers.length}
                  </span>
                )}
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

          {/* Latched Hint Footer */}
          {state.mode === 'latched' && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-gray-400">
              <span className="font-sans">Tap card to jump to article</span>
              <span className="text-slate-300 font-semibold flex items-center gap-0.5">
                <span>Open</span>
                <span aria-hidden="true">↗</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
