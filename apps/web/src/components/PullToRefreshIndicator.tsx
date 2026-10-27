import { RefreshStatus } from '../hooks/usePullToRefresh';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  status: RefreshStatus;
  isPulling?: boolean;
  threshold?: number;
}

export default function PullToRefreshIndicator({
  pullDistance,
  status,
  isPulling = false,
  threshold = 60,
}: PullToRefreshIndicatorProps) {
  if (status === 'idle' && pullDistance <= 0) {
    return null;
  }

  const progress = Math.min(1, pullDistance / threshold);
  const isTriggered = status === 'can-release';
  const isRefreshing = status === 'refreshing';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isClosing = !isPulling && pullDistance === 0 && (isSuccess || isError);

  // Gap between header and cards is 24px (main.pt-6) + pullDistance.
  // Center of gap from header = (24 + pullDistance) / 2.
  // Relative to ClusterList (24px below header): pillY = (pullDistance - 56) / 2.
  // At resting distance 56px: pillY = 0px. Space above = 24px, space below = 24px.
  const pillY = Math.max(0, (pullDistance - 56) / 2);

  return (
    <div
      className="absolute inset-x-0 top-0 flex justify-center pointer-events-none z-0"
      style={{
        transform: `translate3d(0, ${pillY}px, 0)`,
        transition: isPulling
          ? 'none'
          : 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
      aria-live="polite"
    >
      <div
        className={`
          shrink-0 inline-flex items-center justify-center gap-2 px-3.5 h-8 min-w-[152px] rounded-full border text-xs font-medium
          transition-all duration-200
          ${isClosing ? 'opacity-0 scale-95 duration-150' : 'opacity-100'}
          ${!isClosing && isTriggered ? 'shadow-sm' : 'shadow-xs'}
          ${isSuccess ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : ''}
          ${isError ? 'bg-amber-50 text-amber-800 border-amber-200' : ''}
          ${!isSuccess && !isError ? 'bg-white text-gray-700 border-gray-200' : ''}
        `}
        style={{
          opacity: isClosing ? 0 : pullDistance > 10 || isRefreshing || isSuccess || isError ? 1 : 0,
        }}
      >
        {isRefreshing && (
          <>
            <svg
              className="animate-spin h-3.5 w-3.5 text-[#4F6D7A]"
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
            <span>Checking for updates...</span>
          </>
        )}

        {isSuccess && (
          <>
            <svg
              className="h-3.5 w-3.5 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Feed up to date</span>
          </>
        )}

        {isError && (
          <>
            <svg
              className="h-3.5 w-3.5 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Could not reach server</span>
          </>
        )}

        {!isRefreshing && !isSuccess && !isError && (
          <div className="inline-flex items-center gap-2">
            <svg
              className="h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ease-out"
              style={{
                transform: `rotate(${isTriggered ? 180 : 0}deg)`,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="relative inline-block w-[104px] h-4 overflow-hidden whitespace-nowrap text-left">
              <span
                className={`absolute inset-0 flex items-center transition-all duration-200 ease-out ${
                  isTriggered ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
                }`}
              >
                Pull to refresh
              </span>
              <span
                className={`absolute inset-0 flex items-center transition-all duration-200 ease-out ${
                  isTriggered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                }`}
              >
                Release to refresh
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
