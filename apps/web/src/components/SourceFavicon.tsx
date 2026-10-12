import React, { useState } from 'react';
import { isPaywalled } from '../utils/paywallUtils';

export interface SourceFaviconProps {
  source?: {
    id?: string;
    name?: string | null;
    faviconUrl?: string | null;
    homepageUrl?: string | null;
    domain?: string | null;
    paywalled?: boolean | null;
  } | null;
  alt?: string;
  title?: string;
  className?: string;
  showPaywallBadge?: boolean;
}

export function getSourceInitial(name?: string | null): string {
  if (!name || !name.trim()) return 'S';
  return (name.trim()[0] || 'S').toUpperCase();
}

export default function SourceFavicon({
  source,
  alt,
  title,
  className = 'w-5 h-5 rounded-xs',
  showPaywallBadge = false,
}: SourceFaviconProps) {
  const [hasError, setHasError] = useState(false);

  const name = source?.name || 'News Source';
  const initial = getSourceInitial(name);
  const paywalled = showPaywallBadge && isPaywalled(source);
  const resolvedTitle =
    title || `${name}${paywalled ? ' (Subscription required)' : ''}`;

  const content =
    !source?.faviconUrl || hasError ? (
      <span
        className={`inline-flex items-center justify-center bg-slate-200 text-slate-700 font-bold select-none text-[10px] shrink-0 ${className}`}
        title={resolvedTitle}
      >
        {initial}
      </span>
    ) : (
      <img
        src={source.faviconUrl}
        alt={alt !== undefined ? alt : name}
        title={resolvedTitle}
        className={`${className} shrink-0 object-contain`}
        onError={() => setHasError(true)}
      />
    );

  if (showPaywallBadge) {
    return (
      <div className="relative inline-flex items-center shrink-0">
        {content}
        {paywalled && (
          <span
            className="absolute -top-1 -right-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold shadow-xs select-none pointer-events-none"
            title={`${name} (Subscription required)`}
          >
            🔒
          </span>
        )}
      </div>
    );
  }

  return content;
}
