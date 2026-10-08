import React, { useState } from 'react';
import { AngleColorStyle, DEFAULT_ANGLE_COLOR } from '../utils/angleColors';

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

interface ArticleTimelineSparklineProps {
  articles: TimelineArticle[];
  colorMap?: Map<string, AngleColorStyle>;
  fallbackFirstSeen?: number | string | null;
  fallbackLastUpdated?: number | string | null;
  className?: string;
}

function formatRelativeTime(ts: number): string {
  if (isNaN(ts)) return 'N/A';
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ArticleTimelineSparkline({
  articles = [],
  colorMap,
  fallbackFirstSeen,
  fallbackLastUpdated,
  className = '',
}: ArticleTimelineSparklineProps) {
  const [hoveredArticle, setHoveredArticle] = useState<{
    article: TimelineArticle;
    pct: number;
    color: string;
  } | null>(null);

  // Extract valid timestamps
  const validArticles = articles
    .map((a) => {
      const time = a.publishedAt ? new Date(a.publishedAt).getTime() : NaN;
      return { ...a, time };
    })
    .filter((a) => !isNaN(a.time))
    .sort((a, b) => a.time - b.time);

  let minTime = validArticles.length > 0 ? validArticles[0].time : NaN;
  let maxTime = validArticles.length > 0 ? validArticles[validArticles.length - 1].time : NaN;

  if (fallbackFirstSeen) {
    const f = new Date(Number(fallbackFirstSeen)).getTime();
    if (!isNaN(f) && (isNaN(minTime) || f < minTime)) minTime = f;
  }

  if (fallbackLastUpdated) {
    const l = new Date(Number(fallbackLastUpdated)).getTime();
    if (!isNaN(l) && (isNaN(maxTime) || l > maxTime)) maxTime = l;
  }

  if (isNaN(minTime) || isNaN(maxTime)) {
    return null;
  }

  const spanMs = maxTime - minTime;
  const firstSeenLabel = formatRelativeTime(minTime);
  const lastUpdatedLabel = formatRelativeTime(maxTime);

  return (
    <div
      className={`relative py-1.5 ${className}`}
      role="figure"
      aria-label={`Article timeline from ${firstSeenLabel} to ${lastUpdatedLabel} with ${validArticles.length} articles`}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
        {/* Left: First seen */}
        <span className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap" title={`First seen: ${firstSeenLabel}`}>
          {firstSeenLabel}
        </span>

        {/* Central rail track */}
        <div className="relative flex-1 h-[3px] bg-gray-200 rounded-full mx-1">
          {validArticles.map((article) => {
            const pct = spanMs > 0 ? ((article.time - minTime) / spanMs) * 100 : 50;
            const clampedPct = Math.max(1, Math.min(99, pct));

            const style =
              (article.angleId && colorMap?.get(article.angleId)) ||
              (article.angleName && colorMap?.get(article.angleName)) ||
              DEFAULT_ANGLE_COLOR;

            const isHovered = hoveredArticle?.article.id === article.id;

            return (
              <button
                key={article.id}
                type="button"
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group p-1 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-full"
                style={{ left: `${clampedPct}%` }}
                onMouseEnter={() =>
                  setHoveredArticle({ article, pct: clampedPct, color: style.color })
                }
                onMouseLeave={() => setHoveredArticle(null)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${article.title || 'Article'} (${formatRelativeTime(article.time)})`}
              >
                <span
                  className={`block rounded-full ring-1 ring-white transition-all duration-150 ${
                    isHovered ? 'w-3 h-3 scale-125 z-20' : 'w-2 h-2 opacity-90 hover:opacity-100 z-10'
                  }`}
                  style={{ backgroundColor: style.color }}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Last updated */}
        <span className="flex-shrink-0 text-[11px] text-gray-500 font-sans whitespace-nowrap" title={`Last updated: ${lastUpdatedLabel}`}>
          {lastUpdatedLabel}
        </span>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredArticle && (
        <div
          className="absolute bottom-full mb-2 z-30 pointer-events-none transform -translate-x-1/2 bg-gray-900 text-white rounded px-2.5 py-1.5 text-xs shadow-lg max-w-xs transition-opacity duration-150"
          style={{
            left: `${Math.max(15, Math.min(85, hoveredArticle.pct))}%`,
          }}
        >
          <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-gray-300">
            {hoveredArticle.article.sourceRel?.faviconUrl && (
              <img
                src={hoveredArticle.article.sourceRel.faviconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
              />
            )}
            <span className="font-medium text-gray-200">
              {hoveredArticle.article.sourceRel?.name ||
                hoveredArticle.article.source ||
                'News Source'}
            </span>
            <span>•</span>
            <span>{formatRelativeTime((hoveredArticle.article as any).time)}</span>
          </div>
          {hoveredArticle.article.angleName && (
            <div className="text-[10px] font-medium mb-1" style={{ color: '#E4DFDA' }}>
              Angle: {hoveredArticle.article.angleName}
            </div>
          )}
          <div className="line-clamp-2 text-[11px] text-gray-100 font-sans">
            {hoveredArticle.article.title}
          </div>
        </div>
      )}
    </div>
  );
}
