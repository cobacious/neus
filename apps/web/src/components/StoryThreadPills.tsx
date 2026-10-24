import React from 'react';
import { Link } from 'react-router-dom';
import { ThreadColorStyle, createThreadColorMap } from '../utils/threadColors';

export interface ThreadItem {
  id: string;
  name?: string | null;
  articleCount?: number;
}

export interface StoryThreadPillsProps {
  threads: ThreadItem[];
  colorMap?: Map<string, ThreadColorStyle>;
  size?: 'sm' | 'md';
  className?: string;
  activeThreadId?: string | null;
  baseUrl?: string;
  onSelectThread?: (threadId: string) => void;
}

/**
 * Builds the URL to view a story with a specific thread pre-filtered.
 */
export function buildThreadFilterUrl(baseUrl: string, threadId: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}thread=${encodeURIComponent(threadId)}`;
}

export default function StoryThreadPills({
  threads,
  colorMap,
  size = 'sm',
  className = '',
  activeThreadId,
  baseUrl,
  onSelectThread,
}: StoryThreadPillsProps) {
  if (!threads || threads.length === 0) return null;

  // Use provided map or generate one deterministically
  const activeMap =
    colorMap || createThreadColorMap(threads.map((t) => ({ id: t.id, name: t.name || t.id })));

  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';

  const isInteractive = typeof onSelectThread === 'function';
  const isLink = Boolean(baseUrl);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {threads.map((thread) => {
        const style = activeMap.get(thread.id) ||
          activeMap.get(thread.name || '') || {
            bg: '#EEF3F5',
            border: '#4F6D7A',
            text: '#223842',
          };
        const label = thread.name || 'Thread';
        const isActive = isInteractive && activeThreadId === thread.id;

        const Component = isLink ? Link : isInteractive ? 'button' : 'span';
        const interactiveProps = isLink
          ? {
              to: buildThreadFilterUrl(baseUrl!, thread.id),
              onClick: (e: React.MouseEvent) => e.stopPropagation(),
              title: `Filter by ${label} thread`,
              'aria-label': `Filter by ${label} thread (${thread.articleCount ?? 0} articles)`,
            }
          : isInteractive
          ? {
              type: 'button' as const,
              onClick: () => onSelectThread(thread.id),
              'aria-pressed': isActive,
            }
          : {};

        return (
          <Component
            key={thread.id}
            {...(interactiveProps as any)}
            style={{
              backgroundColor: isActive ? style.border : style.bg,
              borderColor: style.border,
              color: isActive ? '#FFFFFF' : style.text,
            }}
            className={`inline-flex items-center gap-1 font-medium rounded-full border transition-all duration-150 pointer-events-auto ${sizeClasses} ${
              isLink || isInteractive
                ? 'cursor-pointer hover:opacity-90 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1'
                : ''
            } ${isActive ? 'shadow-sm font-semibold' : ''}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: isActive ? '#FFFFFF' : style.border }}
              aria-hidden="true"
            />
            <span className="truncate max-w-[160px]">{label}</span>
            {typeof thread.articleCount === 'number' && (
              <span
                style={{ color: isActive ? 'rgba(255,255,255,0.85)' : style.text }}
                className="opacity-75 text-[10px]"
              >
                ({thread.articleCount})
              </span>
            )}
          </Component>
        );
      })}
    </div>
  );
}
