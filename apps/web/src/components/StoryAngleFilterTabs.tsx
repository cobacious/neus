import { AngleItem } from './StoryAnglePills';
import { AngleColorStyle, DEFAULT_ANGLE_COLOR } from '../utils/angleColors';

export interface StoryAngleFilterTabsProps {
  angles: AngleItem[];
  colorMap?: Map<string, AngleColorStyle>;
  selectedAngleId: string | null;
  totalArticlesCount?: number;
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
  onSelectAngle,
  className = '',
}: StoryAngleFilterTabsProps) {
  if (!angles || angles.length === 0) return null;

  return (
    <div className={`relative mb-6 ${className}`}>
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Story thread filter pills"
      >
        {angles.map((angle) => {
          const style =
            colorMap?.get(angle.id) || colorMap?.get(angle.name) || DEFAULT_ANGLE_COLOR;
          const isActive = selectedAngleId === angle.id;

          return (
            <button
              key={angle.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectAngle(isActive ? null : angle.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer select-none ${
                isActive
                  ? 'border-2 font-semibold shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:text-gray-900 font-medium'
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
              {isActive && (
                <span className="text-[10px] ml-0.5 opacity-70" aria-label="Clear thread filter">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
