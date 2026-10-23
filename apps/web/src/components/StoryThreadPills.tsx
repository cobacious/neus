import React from 'react';
import { AngleColorStyle, createAngleColorMap } from '../utils/angleColors';

export interface ThreadItem {
  id: string;
  name?: string | null;
  articleCount?: number;
}

export type AngleItem = ThreadItem;

export interface StoryThreadPillsProps {
  threads?: ThreadItem[];
  angles?: ThreadItem[];
  colorMap?: Map<string, AngleColorStyle>;
  size?: 'sm' | 'md';
  className?: string;
  activeAngleId?: string | null;
  onSelectAngle?: (angleId: string) => void;
}

export type StoryAnglePillsProps = StoryThreadPillsProps;

export default function StoryThreadPills({
  threads,
  angles,
  colorMap,
  size = 'sm',
  className = '',
  activeAngleId,
  onSelectAngle,
}: StoryThreadPillsProps) {
  const items = threads || angles || [];
  if (items.length === 0) return null;

  // Use provided map or generate one deterministically
  const activeMap =
    colorMap || createAngleColorMap(items.map((a) => ({ id: a.id, name: a.name || a.id })));

  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';

  const isInteractive = typeof onSelectAngle === 'function';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((angle) => {
        const style = activeMap.get(angle.id) ||
          activeMap.get(angle.name || '') || {
            bg: '#EEF3F5',
            border: '#4F6D7A',
            text: '#223842',
          };
        const label = angle.name || 'Thread';
        const isActive = isInteractive && activeAngleId === angle.id;

        const Component = isInteractive ? 'button' : 'span';
        const interactiveProps = isInteractive
          ? {
              type: 'button' as const,
              onClick: () => onSelectAngle(angle.id),
              'aria-pressed': isActive,
            }
          : {};

        return (
          <Component
            key={angle.id}
            {...interactiveProps}
            className={`inline-flex items-center font-medium rounded-full border transition-all select-none ${sizeClasses} ${
              isInteractive
                ? isActive
                  ? 'border-2 font-semibold cursor-pointer shadow-xs'
                  : 'hover:opacity-80 cursor-pointer'
                : ''
            }`}
            style={{
              backgroundColor: style.bg,
              borderColor: style.border,
              color: style.text,
            }}
            title={angle.articleCount ? `${label} (${angle.articleCount} articles)` : label}
          >
            {label}
            {typeof angle.articleCount === 'number' && angle.articleCount > 0 && (
              <span className="ml-1 opacity-70 text-[10px]">({angle.articleCount})</span>
            )}
          </Component>
        );
      })}
    </div>
  );
}

export const StoryAnglePills = StoryThreadPills;
