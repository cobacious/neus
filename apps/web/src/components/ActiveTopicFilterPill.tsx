import { getTopicLabel } from '../utils/topics';

interface ActiveTopicFilterPillProps {
  topic: string;
  storyCount: number;
  onClear: () => void;
}

export default function ActiveTopicFilterPill({
  topic,
  storyCount,
  onClear,
}: ActiveTopicFilterPillProps) {
  const topicLabel = getTopicLabel(topic);

  return (
    <aside
      aria-label="Active topic filter"
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] animate-fade-in pointer-events-auto"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#4F6D7A] text-white rounded-full shadow-lg border border-[#4F6D7A]/20 backdrop-blur-md text-xs sm:text-sm font-medium">
        <span className="truncate">
          Showing: <strong className="font-semibold text-white">{topicLabel}</strong> ({storyCount}{' '}
          {storyCount === 1 ? 'story' : 'stories'})
        </span>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
          aria-label={`Clear ${topicLabel} filter`}
        >
          <span>✕</span>
          <span>Clear</span>
        </button>
      </div>
    </aside>
  );
}
