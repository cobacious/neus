import React, { useState, useMemo } from 'react';
import { AngleColorStyle, DEFAULT_ANGLE_COLOR } from '../utils/angleColors';
import { parseDate, formatRelativeTime } from '../utils/dateUtils';

export interface TimelineArticle {
  id: string;
  title?: string | null;
  publishedAt?: string | number | null;
  source?: string | null;
  sourceRel?: {
    id?: string;
    name?: string | null;
    faviconUrl?: string | null;
  } | null;
  angleId?: string | null;
  angleName?: string | null;
}

export interface TimelineMarker {
  id: string;
  pct: number;
  color: string;
  angleStyle: AngleColorStyle;
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

export interface ArticleTimelineSparklineProps {
  articles?: TimelineArticle[];
  colorMap?: Map<string, AngleColorStyle>;
  fallbackFirstSeen?: number | string | null;
  fallbackLastUpdated?: number | string | null;
  className?: string;
}

/**
 * Computes timeline markers along a clean, flat single horizontal rail.
 * - Every article has its own individual dot on the rail.
 * - Every dot strictly displays its angle's palette color.
 * - First seen is anchored at 0%, last updated is anchored at 100%.
 */
export function buildTimelineMarkers(
  articles: TimelineArticle[] = [],
  options?: {
    colorMap?: Map<string, AngleColorStyle>;
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

    const angleStyle =
      (article.angleId && colorMap?.get(article.angleId)) ||
      (article.angleName && colorMap?.get(article.angleName)) ||
      DEFAULT_ANGLE_COLOR;

    return {
      id: article.id,
      pct,
      color: angleStyle.color,
      angleStyle,
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
}: ArticleTimelineSparklineProps) {
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);

  const layout = useMemo(
    () =>
      buildTimelineMarkers(articles, {
        colorMap,
        fallbackFirstSeen,
        fallbackLastUpdated,
      }),
    [articles, colorMap, fallbackFirstSeen, fallbackLastUpdated]
  );

  if (!layout) {
    return null;
  }

  const { firstSeenLabel, lastUpdatedLabel, validArticles, markers } = layout;

  return (
    <div
      className={`relative py-1.5 ${className}`}
      role="figure"
      aria-label={`Article timeline from ${firstSeenLabel} to ${lastUpdatedLabel} with ${validArticles.length} articles`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        {/* Left: First seen */}
        <span
          className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap"
          title={`First seen: ${firstSeenLabel}`}
        >
          {firstSeenLabel}
        </span>

        {/* Central rail track with anchored endpoint terminals */}
        <div className="relative flex-1 h-[3px] bg-gray-200 rounded-full mx-1">
          {/* Subtle rail anchor terminals at both ends */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-300 pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute left-full top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gray-300 pointer-events-none"
            aria-hidden="true"
          />

          {/* Interactive timeline markers on single flat rail */}
          {markers.map((marker) => {
            const isHovered = hoveredMarker?.id === marker.id;

            return (
              <button
                key={marker.id}
                type="button"
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-1 focus:outline-none focus:ring-1 focus:ring-gray-400 rounded-full transition-transform duration-100"
                style={{
                  left: `${marker.pct}%`,
                  transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.35)' : 'scale(1)'}`,
                  zIndex: isHovered ? 30 : 10,
                }}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${marker.article.title || 'Article'} (${formatRelativeTime(marker.time)})`}
              >
                <span
                  className="block w-2 h-2 rounded-full ring-1 ring-white shadow-2xs"
                  style={{ backgroundColor: marker.color }}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Last updated */}
        <span
          className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap"
          title={`Last updated: ${lastUpdatedLabel}`}
        >
          {lastUpdatedLabel}
        </span>
      </div>

      {/* Floating Hover Tooltip: Wide, comfortable (w-64) with intelligent boundary anchoring */}
      {hoveredMarker && (
        <div
          className={`absolute bottom-full mb-2 z-30 pointer-events-none bg-gray-900 text-white rounded-md p-3 text-xs shadow-xl w-64 max-w-[calc(100vw-32px)] transition-all duration-150 border border-gray-800 ${
            hoveredMarker.pct < 20
              ? 'left-0 translate-x-0'
              : hoveredMarker.pct > 80
              ? 'left-full -translate-x-full'
              : '-translate-x-1/2'
          }`}
          style={
            hoveredMarker.pct >= 20 && hoveredMarker.pct <= 80
              ? { left: `${hoveredMarker.pct}%` }
              : undefined
          }
        >
          {/* Header: Source favicon, name, and relative time */}
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-gray-300">
            {hoveredMarker.article.sourceRel?.faviconUrl && (
              <img
                src={hoveredMarker.article.sourceRel.faviconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-xs"
              />
            )}
            <span className="font-semibold text-gray-200">
              {hoveredMarker.article.sourceRel?.name ||
                hoveredMarker.article.source ||
                'News Source'}
            </span>
            <span>•</span>
            <span>{formatRelativeTime(hoveredMarker.time)}</span>
          </div>

          {/* Angle Tag Pill */}
          {hoveredMarker.article.angleName && (
            <div className="mb-1.5">
              <span
                className="inline-block px-1.5 py-0.5 rounded-xs text-[9px] font-semibold border uppercase tracking-wider"
                style={{
                  backgroundColor: hoveredMarker.angleStyle.bg,
                  borderColor: hoveredMarker.angleStyle.border,
                  color: hoveredMarker.angleStyle.text,
                }}
              >
                {hoveredMarker.article.angleName}
              </span>
            </div>
          )}

          {/* Headline */}
          <div className="line-clamp-2 text-[11px] text-gray-100 font-sans leading-relaxed">
            {hoveredMarker.article.title}
          </div>
        </div>
      )}
    </div>
  );
}
