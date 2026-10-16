import { useRef, useEffect } from 'react';
import { AngleItem } from './StoryAnglePills';
import { AngleColorStyle, DEFAULT_ANGLE_COLOR } from '../utils/angleColors';

export interface StoryAngleFilterTabsProps {
  angles: AngleItem[];
  colorMap?: Map<string, AngleColorStyle>;
  selectedAngleId: string | null;
  totalArticlesCount: number;
  onSelectAngle: (angleId: string | null) => void;
  className?: string;
}

/**
 * Resolves the active angle ID against valid cluster IDs.
 * Returns null if the param is missing or not present in the valid IDs.
 */
export function resolveActiveAngleId(
  validAngleIds: Iterable<string>,
  angleParam: string | null | undefined
): string | null {
  if (!angleParam) return null;
  const set = validAngleIds instanceof Set ? validAngleIds : new Set(validAngleIds);
  return set.has(angleParam) ? angleParam : null;
}

export default function StoryAngleFilterTabs({
  angles,
  colorMap,
  selectedAngleId,
  totalArticlesCount,
  onSelectAngle,
  className = '',
}: StoryAngleFilterTabsProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedAngleId]);

  if (!angles || angles.length === 0) return null;

  const isAllActive = selectedAngleId === null;

  return (
    <div className={`relative mb-6 ${className}`}>
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none"
        role="tablist"
        aria-label="Story angle filter tabs"
      >
        {/* All Angles Tab */}
        <button
          ref={isAllActive ? activeTabRef : null}
          type="button"
          role="tab"
          aria-selected={isAllActive}
          onClick={() => onSelectAngle(null)}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer select-none border ${
            isAllActive
              ? 'bg-gray-900 text-white border-gray-900 font-semibold shadow-xs ring-2 ring-gray-900 ring-offset-1'
              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:text-gray-900 font-medium'
          }`}
        >
          <span>All Angles</span>
          <span
            className={`text-[11px] font-normal ${
              isAllActive ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            ({totalArticlesCount})
          </span>
        </button>

        {/* Individual Angle Tabs */}
        {angles.map((angle) => {
          const style =
            colorMap?.get(angle.id) || colorMap?.get(angle.name) || DEFAULT_ANGLE_COLOR;
          const isActive = selectedAngleId === angle.id;

          return (
            <button
              key={angle.id}
              ref={isActive ? activeTabRef : null}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectAngle(isActive ? null : angle.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer select-none border ${
                isActive
                  ? 'font-semibold shadow-xs ring-2 ring-gray-700 ring-offset-1'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 font-medium'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: style.bg,
                      borderColor: style.border,
                      color: style.text,
                    }
                  : undefined
              }
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: style.border }}
                aria-hidden="true"
              />
              <span>{angle.name}</span>
              {typeof angle.articleCount === 'number' && (
                <span
                  className={`text-[11px] font-normal ${
                    isActive ? 'opacity-80' : 'text-gray-400'
                  }`}
                >
                  ({angle.articleCount})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
