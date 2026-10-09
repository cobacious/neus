import React, { useState, useMemo } from 'react';
import { AngleColorStyle, DEFAULT_ANGLE_COLOR } from '../utils/angleColors';
import { parseDate } from '../utils/dateUtils';

export interface HistogramArticle {
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

interface StoryAngleHistogramProps {
  articles: HistogramArticle[];
  angles?: Array<{ id: string; name?: string | null }>;
  colorMap?: Map<string, AngleColorStyle>;
  className?: string;
}

export interface BinSegment {
  angleId: string;
  angleName: string;
  color: string;
  count: number;
  sources: string[];
}

export interface TimeBin {
  label: string;
  rangeLabel: string;
  startTime: number;
  endTime: number;
  total: number;
  segments: BinSegment[];
}

export interface HistogramBinsResult {
  bins: TimeBin[];
  maxBinTotal: number;
  validArticles: (HistogramArticle & { time: number })[];
}

/**
 * Computes adaptive time bins for article publication histogram.
 * - Granular 15m/30m/1h/2h bucketing for rapid breaking news instead of coarse 6h buckets.
 * - Clean day transitions without redundant weekday repeats on same-day bins.
 * - Stacked segment breakdown by story angle.
 */
export function buildHistogramBins(
  articles: HistogramArticle[] = [],
  colorMap?: Map<string, AngleColorStyle>
): HistogramBinsResult {
  // 1. Filter valid articles and sort chronologically
  const validArticles = articles
    .map((a) => {
      const parsed = parseDate(a.publishedAt);
      const time = parsed ? parsed.getTime() : NaN;
      return { ...a, time };
    })
    .filter((a) => !isNaN(a.time))
    .sort((a, b) => a.time - b.time);

  if (validArticles.length === 0) {
    return { bins: [], maxBinTotal: 0, validArticles: [] };
  }

  const minTime = validArticles[0].time;
  const maxTime = validArticles[validArticles.length - 1].time;
  const spanMs = Math.max(0, maxTime - minTime);
  const spanHours = spanMs / (1000 * 60 * 60);

  // Determine bucket size and formatting granularity
  let bucketMs: number;
  let isSubHour = false;
  let isSubDay = false;

  if (spanHours <= 1.5) {
    // 15-minute buckets for fast-breaking events
    bucketMs = 15 * 60 * 1000;
    isSubHour = true;
    isSubDay = true;
  } else if (spanHours <= 4) {
    // 30-minute buckets for breaking news unfolding over a few hours
    bucketMs = 30 * 60 * 1000;
    isSubHour = true;
    isSubDay = true;
  } else if (spanHours <= 12) {
    // 1-hour buckets for same-day developments
    bucketMs = 60 * 60 * 1000;
    isSubDay = true;
  } else if (spanHours <= 24) {
    // 2-hour buckets for 24-hour cycles
    bucketMs = 2 * 60 * 60 * 1000;
    isSubDay = true;
  } else if (spanHours <= 48) {
    // 4-hour buckets for 2-day developments
    bucketMs = 4 * 60 * 60 * 1000;
    isSubDay = true;
  } else if (spanHours <= 24 * 7) {
    // 1-day buckets for up to 1 week
    bucketMs = 24 * 60 * 60 * 1000;
  } else if (spanHours <= 24 * 14) {
    // 2-day buckets for up to 2 weeks
    bucketMs = 2 * 24 * 60 * 60 * 1000;
  } else {
    // Multi-day buckets targeting ~10-14 bins for long-running stories
    const targetDays = Math.max(3, Math.ceil(spanHours / (24 * 12)));
    bucketMs = targetDays * 24 * 60 * 60 * 1000;
  }

  // Align start to nice boundary
  const startAligned = Math.floor(minTime / bucketMs) * bucketMs;
  const endAligned = Math.ceil((maxTime + 1) / bucketMs) * bucketMs;
  const numBuckets = Math.max(1, Math.min(24, Math.round((endAligned - startAligned) / bucketMs)));

  const createdBins: TimeBin[] = [];
  let prevDay = '';

  for (let i = 0; i < numBuckets; i++) {
    const bStart = startAligned + i * bucketMs;
    const bEnd = bStart + bucketMs;
    const dStart = new Date(bStart);
    const dEnd = new Date(bEnd);

    let label: string;
    let rangeLabel: string;

    if (isSubDay) {
      const curDay = dStart.toLocaleDateString(undefined, { weekday: 'short' });
      const startHour = dStart.getHours().toString().padStart(2, '0');
      const startMin = dStart.getMinutes().toString().padStart(2, '0');
      const endHour = dEnd.getHours().toString().padStart(2, '0');
      const endMin = dEnd.getMinutes().toString().padStart(2, '0');

      const timeStr = isSubHour ? `${startHour}:${startMin}` : `${startHour}:00`;
      const endTimeStr = isSubHour ? `${endHour}:${endMin}` : `${endHour}:00`;

      // Show day prefix on first bin or when day transitions; subsequent bins show clean time
      if (i === 0 || curDay !== prevDay) {
        label = `${curDay} ${timeStr}`;
        prevDay = curDay;
      } else {
        label = timeStr;
      }

      rangeLabel = `${curDay} ${timeStr} – ${endTimeStr}`;
    } else {
      label = dStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      rangeLabel = label;
    }

    createdBins.push({
      label,
      rangeLabel,
      startTime: bStart,
      endTime: bEnd,
      total: 0,
      segments: [],
    });
  }

  // Group articles into bins
  validArticles.forEach((article) => {
    let bIdx = Math.floor((article.time - startAligned) / bucketMs);
    if (bIdx < 0) bIdx = 0;
    if (bIdx >= createdBins.length) bIdx = createdBins.length - 1;

    const bin = createdBins[bIdx];
    bin.total += 1;

    const aId = article.angleId || article.angleName || 'default';
    const aName = article.angleName || 'Articles';
    const style =
      (article.angleId && colorMap?.get(article.angleId)) ||
      (article.angleName && colorMap?.get(article.angleName)) ||
      DEFAULT_ANGLE_COLOR;

    let seg = bin.segments.find((s) => s.angleId === aId);
    if (!seg) {
      seg = {
        angleId: aId,
        angleName: aName,
        color: style.color,
        count: 0,
        sources: [],
      };
      bin.segments.push(seg);
    }
    seg.count += 1;
    const srcName = article.sourceRel?.name || article.source;
    if (srcName && !seg.sources.includes(srcName)) {
      seg.sources.push(srcName);
    }
  });

  const max = createdBins.reduce((acc, b) => Math.max(acc, b.total), 0);
  return { bins: createdBins, maxBinTotal: max, validArticles };
}

export default function StoryAngleHistogram({
  articles = [],
  angles = [],
  colorMap,
  className = '',
}: StoryAngleHistogramProps) {
  const [hoveredBinIndex, setHoveredBinIndex] = useState<number | null>(null);

  const { bins, maxBinTotal, validArticles } = useMemo(() => {
    return buildHistogramBins(articles, colorMap);
  }, [articles, colorMap]);

  if (validArticles.length === 0 || bins.length === 0) {
    return null;
  }

  // Chart layout dimensions
  const svgWidth = 600;
  const svgHeight = 180;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const yMax = Math.max(3, Math.ceil(maxBinTotal * 1.15));
  const slotWidth = chartWidth / bins.length;
  const barWidth = Math.max(6, Math.min(36, slotWidth * 0.72));

  // Y-axis ticks
  const yTicks = [0, Math.ceil(yMax / 2), yMax];

  const hoveredBin = hoveredBinIndex !== null ? bins[hoveredBinIndex] : null;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 shadow-xs ${className}`}
      role="region"
      aria-label="Story article publication histogram"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Publication Timeline & Angles
        </h4>
        <span className="text-xs text-gray-500">
          {validArticles.length} {validArticles.length === 1 ? 'article' : 'articles'} total
        </span>
      </div>

      {/* Angle Legend */}
      {angles.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
          {angles.map((angle) => {
            const style =
              colorMap?.get(angle.id) ||
              (angle.name && colorMap?.get(angle.name)) ||
              DEFAULT_ANGLE_COLOR;
            const count = validArticles.filter(
              (a) => a.angleId === angle.id || a.angleName === angle.name
            ).length;

            return (
              <div key={angle.id} className="flex items-center gap-1.5 text-gray-700">
                <span
                  className="w-2.5 h-2.5 rounded-xs flex-shrink-0"
                  style={{ backgroundColor: style.color }}
                />
                <span className="font-medium">{angle.name || 'Angle'}</span>
                <span className="text-gray-400">({count})</span>
              </div>
            );
          })}
        </div>
      )}

      {/* SVG Stacked Bar Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
          role="img"
          aria-label={`Histogram showing ${validArticles.length} articles over time`}
        >
          {/* Horizontal Gridlines & Y-Axis labels */}
          {yTicks.map((tick) => {
            const y = paddingTop + chartHeight - (tick / yMax) * chartHeight;
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9ca3af"
                  fontFamily="inherit"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Stacked Bars */}
          {bins.map((bin, i) => {
            const x = paddingLeft + i * slotWidth + (slotWidth - barWidth) / 2;
            const isHovered = hoveredBinIndex === i;

            // Compute stacked segment offsets
            let currentBottom = paddingTop + chartHeight;

            return (
              <g
                key={bin.startTime}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredBinIndex(i)}
                onMouseLeave={() => setHoveredBinIndex(null)}
              >
                {/* Transparent hover capture column */}
                <rect
                  x={paddingLeft + i * slotWidth}
                  y={paddingTop}
                  width={slotWidth}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Subtle column highlight background on hover */}
                {isHovered && (
                  <rect
                    x={paddingLeft + i * slotWidth}
                    y={paddingTop}
                    width={slotWidth}
                    height={chartHeight}
                    fill="rgba(79, 109, 122, 0.06)"
                    rx="3"
                  />
                )}

                {/* Stacked segments for this bin */}
                {bin.segments.map((seg) => {
                  const segHeight = (seg.count / yMax) * chartHeight;
                  const segY = currentBottom - segHeight;
                  currentBottom = segY;

                  return (
                    <rect
                      key={seg.angleId}
                      x={x}
                      y={segY}
                      width={barWidth}
                      height={Math.max(1.5, segHeight)}
                      fill={seg.color}
                      opacity={isHovered ? 1 : 0.88}
                      rx="1.5"
                      className="transition-opacity duration-150"
                    />
                  );
                })}

                {/* X-axis label */}
                <text
                  x={paddingLeft + i * slotWidth + slotWidth / 2}
                  y={paddingTop + chartHeight + 18}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={isHovered ? '#1f2937' : '#9ca3af'}
                  fontWeight={isHovered ? '600' : '400'}
                  fontFamily="inherit"
                >
                  {bin.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Popover Tooltip */}
        {hoveredBin && (() => {
          const hoverPct =
            hoveredBinIndex !== null
              ? ((paddingLeft + (hoveredBinIndex + 0.5) * slotWidth) / svgWidth) * 100
              : 50;

          return (
            <div
              className={`absolute bottom-full mb-2 z-30 pointer-events-none bg-gray-900 text-white rounded-lg p-3 text-xs shadow-xl min-w-[190px] max-w-[calc(100vw-32px)] transition-all duration-150 border border-gray-800 ${
                hoverPct < 20
                  ? 'left-0 translate-x-0'
                  : hoverPct > 80
                  ? 'left-full -translate-x-full'
                  : '-translate-x-1/2'
              }`}
              style={
                hoverPct >= 20 && hoverPct <= 80
                  ? { left: `${hoverPct}%` }
                  : undefined
              }
            >
              <div className="font-semibold text-gray-200 border-b border-gray-700 pb-1 mb-1.5 flex justify-between gap-4">
                <span>{hoveredBin.rangeLabel || hoveredBin.label}</span>
                <span className="text-gray-400 font-normal whitespace-nowrap">
                  {hoveredBin.total} {hoveredBin.total === 1 ? 'article' : 'articles'}
                </span>
              </div>
              {hoveredBin.segments.length > 0 ? (
                <div className="space-y-1">
                  {hoveredBin.segments.map((seg) => (
                    <div
                      key={seg.angleId}
                      className="flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="truncate text-gray-300">{seg.angleName}</span>
                      </div>
                      <span className="font-semibold text-gray-100 flex-shrink-0">
                        {seg.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-[11px] italic py-0.5">
                  No articles in this window
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
