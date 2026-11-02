import { useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { formatRelativeTime } from '../utils/dateUtils';

export const PIPELINE_STATUS_QUERY = `
  query PipelineStatus {
    pipelineStatus {
      lastRunAt
      lastRunIso
    }
  }
`;

export function formatLastUpdated(
  lastRunAt: number | string | Date | null | undefined,
  referenceTime?: number
): string | null {
  if (lastRunAt == null) return null;
  const rel = formatRelativeTime(lastRunAt, referenceTime);
  if (rel === 'N/A') return null;
  return rel === 'Just now' ? 'Updated just now' : `Updated ${rel}`;
}

export interface LastUpdatedProps {
  className?: string;
  referenceTime?: number;
}

export default function LastUpdated({
  className = 'text-xs text-neutral-400',
  referenceTime,
}: LastUpdatedProps = {}) {
  const [result] = useQuery({ query: PIPELINE_STATUS_QUERY });
  const [formattedTime, setFormattedTime] = useState<string | null>(null);
  const lastRunAt = result.data?.pipelineStatus?.lastRunAt;

  useEffect(() => {
    if (!lastRunAt) {
      setFormattedTime(null);
      return;
    }
    setFormattedTime(formatLastUpdated(lastRunAt, referenceTime));
  }, [lastRunAt, referenceTime]);

  if (!formattedTime) {
    return null;
  }

  return (
    <>
      <span aria-hidden="true" className="text-gray-300">·</span>
      <span className={className}>{formattedTime}</span>
    </>
  );
}
