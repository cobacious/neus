/**
 * Robust date utilities for parsing and formatting dates across Neus web.
 * Prevents "Invalid Date" bugs by handling ISO strings, numeric timestamps (ms and s),
 * Date objects, and nullish inputs safely.
 */

export function parseDate(value: number | string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value) || value <= 0) return null;
    // Distinguish seconds vs milliseconds (Unix timestamp vs JS timestamp)
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Check if purely numeric string
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (isNaN(num) || !isFinite(num) || num <= 0) return null;
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function formatRelativeTime(
  value: number | string | Date | null | undefined,
  referenceTime: number = Date.now()
): string {
  const date = parseDate(value);
  if (!date) return 'N/A';

  const diffMs = referenceTime - date.getTime();

  // If timestamp is slightly in the future due to clock skew, treat as just now
  if (diffMs < 60000) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateHeader(value: number | string | Date | null | undefined): string {
  const date = parseDate(value);
  if (!date) return 'Unknown Date';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
