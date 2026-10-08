import React from 'react';

export type StoryStatus = 'breaking' | 'developing' | 'dormant';

interface StatusBadgeProps {
  status?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function resolveStoryStatus(
  status?: string | null,
  clusterMeta?: { createdAt?: number | string | null; lastUpdatedAt?: number | string | null }
): StoryStatus {
  if (status) {
    const s = status.toLowerCase();
    if (s === 'breaking') return 'breaking';
    if (s === 'dormant') return 'dormant';
    return 'developing';
  }

  // Fallback based on recency if cluster is standalone
  const ts = clusterMeta?.lastUpdatedAt ?? clusterMeta?.createdAt;
  if (!ts) return 'developing';
  const time = new Date(Number(ts)).getTime();
  if (isNaN(time)) return 'developing';

  const diffHours = (Date.now() - time) / (1000 * 60 * 60);
  if (diffHours <= 12) return 'breaking';
  if (diffHours <= 24 * 7) return 'developing';
  return 'dormant';
}

export default function StatusBadge({ status, size = 'sm', className = '' }: StatusBadgeProps) {
  const normalized = (status || 'developing').toLowerCase() as StoryStatus;

  const config = {
    breaking: {
      label: 'Breaking',
      bg: '#FCF2EE',
      border: 'rgba(221, 110, 66, 0.4)',
      text: '#8C3411',
      dot: '#DD6E42',
    },
    developing: {
      label: 'Developing',
      bg: '#EEF3F5',
      border: 'rgba(79, 109, 122, 0.4)',
      text: '#223842',
      dot: '#4F6D7A',
    },
    dormant: {
      label: 'Dormant',
      bg: '#F5F4F4',
      border: 'rgba(87, 83, 83, 0.3)',
      text: '#292525',
      dot: '#575353',
    },
  }[normalized] || {
    label: 'Developing',
    bg: '#EEF3F5',
    border: 'rgba(79, 109, 122, 0.4)',
    text: '#223842',
    dot: '#4F6D7A',
  };

  const sizeClasses =
    size === 'md'
      ? 'px-2.5 py-1 text-xs font-medium'
      : 'px-2 py-0.5 text-[11px] font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs select-none ${sizeClasses} ${className}`}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        color: config.text,
      }}
      role="status"
      aria-label={`Story status: ${config.label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full mr-1.5 flex-shrink-0"
        style={{ backgroundColor: config.dot }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
