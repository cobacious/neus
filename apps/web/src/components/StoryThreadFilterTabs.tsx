import { ThreadItem } from './StoryThreadPills';
import { ThreadColorStyle, DEFAULT_THREAD_COLOR } from '../utils/threadColors';

export interface StoryThreadFilterTabsProps {
  threads: ThreadItem[];
  colorMap?: Map<string, ThreadColorStyle>;
  selectedThreadId: string | null;
  totalArticlesCount?: number;
  onSelectThread: (threadId: string | null) => void;
  className?: string;
}

/**
 * Resolves the active thread ID against valid cluster IDs.
 * Returns null if the param is missing or not present in the valid IDs.
 */
export function resolveActiveThreadId(
  validThreadIds: Iterable<string>,
  threadParam: string | null | undefined
): string | null {
  if (!threadParam) return null;
  const set = validThreadIds instanceof Set ? validThreadIds : new Set(validThreadIds);
  return set.has(threadParam) ? threadParam : null;
}

export default function StoryThreadFilterTabs({
  threads,
  colorMap,
  selectedThreadId,
  onSelectThread,
  className = '',
}: StoryThreadFilterTabsProps) {
  if (!threads || threads.length === 0) return null;

  return (
    <div className={`relative mb-6 ${className}`}>
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Story thread filter pills"
      >
        {threads.map((thread) => {
          const style =
            colorMap?.get(thread.id) ||
            (thread.name ? colorMap?.get(thread.name) : undefined) ||
            DEFAULT_THREAD_COLOR;
          const isActive = selectedThreadId === thread.id;

          return (
            <button
              key={thread.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectThread(isActive ? null : thread.id)}
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
              <span>{thread.name}</span>
              {typeof thread.articleCount === 'number' && (
                <span
                  className={`text-[11px] font-normal ${isActive ? 'opacity-80' : 'text-gray-400'}`}
                >
                  ({thread.articleCount})
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
