import React from 'react';
import { parseDate } from '../utils/dateUtils';

export type StoryStatus = 'breaking' | 'developing';

export interface ClusterMeta {
  createdAt?: number | string | null;
  lastUpdatedAt?: number | string | null;
  isMultiAngle?: boolean;
  articles?: Array<{ publishedAt?: number | string | null }>;
}

interface StatusBadgeProps {
  status?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Resolves the display status for a story or cluster:
 * - 'breaking': Fresh event (< 18h) where details are actively emerging.
 * - 'developing': Exclusively for multi-angle stories that are actively growing in scope.
 * - null: Standard/routine news, single-angle stories past the breaking window, or dormant items.
 */
export function resolveStoryStatus(
  status?: string | null,
  clusterMeta?: ClusterMeta,
  referenceNow: number = Date.now()
): StoryStatus | null {
  const norm = status ? status.toLowerCase().trim() : null;

  // Dormant status is dropped from the UI taxonomy
  if (norm === 'dormant') {
    return null;
  }

  // Extract timestamps safely
  const startDate = parseDate(clusterMeta?.createdAt);
  const lastUpdateDate = parseDate(clusterMeta?.lastUpdatedAt) ?? startDate;

  const startTime = startDate?.getTime();
  const lastUpdateTime = lastUpdateDate?.getTime();
  const isMultiAngle = Boolean(clusterMeta?.isMultiAngle);

  const lifespanHours =
    startTime !== undefined ? (referenceNow - startTime) / (1000 * 60 * 60) : undefined;
  const hoursSinceLastUpdate =
    lastUpdateTime !== undefined ? (referenceNow - lastUpdateTime) / (1000 * 60 * 60) : undefined;

  // Inactivity check: stories without updates for > 7 days have no badge
  if (hoursSinceLastUpdate !== undefined && hoursSinceLastUpdate > 7 * 24) {
    return null;
  }

  // 1. Explicit Breaking status
  if (norm === 'breaking') {
    // Breaking window: event began within last 18 hours and updates are recent
    const isFresh = lifespanHours === undefined || lifespanHours <= 18;
    const isRecent = hoursSinceLastUpdate === undefined || hoursSinceLastUpdate <= 12;

    if (isFresh && isRecent) {
      return 'breaking';
    }

    // After breaking phase decays:
    // If it has grown into a multi-angle story, it transitions to 'developing'
    if (isMultiAngle) {
      return 'developing';
    }

    // Otherwise, standalone cluster drops badge to clean default
    return null;
  }

  // 2. Explicit Developing status
  if (norm === 'developing') {
    // Strictly reserved for multi-angle stories. Single-cluster reports are never developing.
    if (!isMultiAngle) {
      return null;
    }
    return 'developing';
  }

  // 3. Fallback / Implicit evaluation (e.g. standalone cluster with no story status)
  // Only qualifies as breaking if very fresh (< 12h) with recent activity
  if (
    lifespanHours !== undefined &&
    lifespanHours <= 12 &&
    (hoursSinceLastUpdate === undefined || hoursSinceLastUpdate <= 6)
  ) {
    return 'breaking';
  }

  // Multi-angle stories with no explicit status, but active
  if (isMultiAngle && (hoursSinceLastUpdate === undefined || hoursSinceLastUpdate <= 48)) {
    return 'developing';
  }

  // Clean default: no badge for standard news
  return null;
}

export const STATUS_CONFIG = {
  breaking: {
    label: 'Breaking',
    topBorder: '#DD6E42', // Burnt Peach from agreed palette
    badgeBorder: '#DD6E42',
    text: '#8C3411',
    dot: '#DD6E42',
    bg: '#FFFFFF',
  },
  developing: {
    label: 'Developing',
    topBorder: '#4F6D7A', // Blue Slate from agreed palette
    badgeBorder: '#4F6D7A',
    text: '#223842',
    dot: '#4F6D7A',
    bg: '#FFFFFF',
  },
} as const;

export default function StatusBadge({ status, size = 'sm', className = '' }: StatusBadgeProps) {
  if (!status || (status !== 'breaking' && status !== 'developing')) {
    return null;
  }

  const config = STATUS_CONFIG[status as StoryStatus];

  const sizeClasses =
    size === 'md'
      ? 'px-2.5 py-1 text-[11px]'
      : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded-xs border shadow-2xs select-none font-bold tracking-wider uppercase ${sizeClasses} ${className}`}
      style={{
        backgroundColor: config.bg,
        borderColor: config.badgeBorder,
        color: config.text,
      }}
      role="status"
      aria-label={`Story status: ${config.label}`}
    >
      {status === 'breaking' ? (
        <span className="relative flex h-1.5 w-1.5 mr-1.5 flex-shrink-0" aria-hidden="true">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.dot }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: config.dot }}
          />
        </span>
      ) : (
        <span
          className="h-1.5 w-1.5 rounded-full mr-1.5 flex-shrink-0"
          style={{ backgroundColor: config.dot }}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}
