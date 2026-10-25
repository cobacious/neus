interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export default function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 65,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) {
    return null;
  }

  const progress = Math.min(1, pullDistance / threshold);
  const isTriggered = pullDistance >= threshold;

  return (
    <div
      className="fixed left-0 right-0 top-14 z-30 flex justify-center pointer-events-none transition-transform duration-100 ease-out"
      style={{
        transform: `translateY(${pullDistance * 0.75}px)`,
      }}
      aria-hidden="true"
    >
      <div className="bg-white border border-gray-200 shadow-md rounded-full px-3.5 py-1.5 flex items-center gap-2">
        {isRefreshing ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-[#4F6D7A]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-xs font-medium text-gray-700">Updating feed...</span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 text-gray-500 transition-transform duration-200"
              style={{
                transform: `rotate(${isTriggered ? 180 : progress * 140}deg)`,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="text-xs font-medium text-gray-600">
              {isTriggered ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
