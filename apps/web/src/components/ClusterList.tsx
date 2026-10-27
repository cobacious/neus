import { useState, useEffect, useCallback } from 'react';
import { useQuery, useClient } from 'urql';
import ClusterCard from './ClusterCard';
import ClusterCardSkeleton from './ClusterCardSkeleton';
import Loading from './Loading';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useStaleRefresh } from '../hooks/useStaleRefresh';
import { isStandalonePwa } from '../pwa';

const CLUSTERS_QUERY = `
  query GetClusters($limit: Int, $offset: Int) {
    clusters(limit: $limit, offset: $offset) {
      id
      headline
      slug
      summary
      createdAt
      lastUpdatedAt
      origin
      storyId
      storyAngle
      story {
        id
        title
        slug
        overview
        status
        clusters {
          id
          headline
          slug
          storyAngle
          createdAt
          articles {
            id
            title
            publishedAt
            source
            sourceRel {
              id
              name
              faviconUrl
              paywalled
            }
          }
        }
      }
      articles {
        id
        url
        title
        publishedAt
        source
        sourceRel {
          id
          name
          faviconUrl
          paywalled
        }
      }
    }
    clusterCount
  }
`;

const CLUSTERS_PER_PAGE = 15;

export default function ClusterList() {
  const [displayedClusters, setDisplayedClusters] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const client = useClient();

  const [result, reexecuteQuery] = useQuery({
    query: CLUSTERS_QUERY,
    variables: { limit: CLUSTERS_PER_PAGE, offset },
    requestPolicy: 'cache-and-network',
  });

  const handleRefresh = useCallback(async (): Promise<boolean> => {
    setOffset(0);
    try {
      const res = await client
        .query(CLUSTERS_QUERY, { limit: CLUSTERS_PER_PAGE, offset: 0 }, { requestPolicy: 'network-only' })
        .toPromise();

      if (res.data?.clusters) {
        setDisplayedClusters(res.data.clusters);
        return true;
      }
      return !res.error;
    } catch (_) {
      return false;
    }
  }, [client]);

  const isStandalone = isStandalonePwa();

  const { pullDistance, status, isPulling, threshold, contentStyle } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isStandalone,
  });

  useEffect(() => {
    if (isStandalone) {
      document.documentElement.style.overscrollBehaviorY = 'none';
      return () => {
        document.documentElement.style.overscrollBehaviorY = '';
      };
    }
  }, [isStandalone]);

  const { markFresh } = useStaleRefresh({
    onRefresh: handleRefresh,
    staleDurationMs: 5 * 60 * 1000,
  });

  useEffect(() => {
    document.title = 'Neus - Neutral News';
  }, []);

  // Update displayed clusters when new data arrives
  useEffect(() => {
    if (result.data && !result.fetching) {
      markFresh();
      const rawClusters = result.data.clusters || [];
      if (offset === 0) {
        // Initial load or refresh
        setDisplayedClusters(rawClusters);
      } else if (rawClusters.length > 0) {
        // Loading more - append new clusters avoiding duplicate IDs across pages
        setDisplayedClusters((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const nextItems = rawClusters.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...nextItems];
        });
      }
    }
  }, [result.data, result.fetching, offset, markFresh]);

  const handleLoadMore = () => {
    setOffset(displayedClusters.length);
  };

  // Initial loading state
  if (result.fetching && displayedClusters.length === 0) {
    return (
      <div className="space-y-5">
        {[...Array(5)].map((_, i) => (
          <ClusterCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (result.error && displayedClusters.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-10 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-50/60">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Live Feed Temporarily Unavailable</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto leading-normal">
            Neus is unable to connect to the news feed right now. Please check your internet connection and try again.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3 text-xs">
          <button
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const totalClusters = result.data?.clusterCount ?? 0;
  const hasMore = displayedClusters.length < totalClusters;

  return (
    <div className="relative">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        status={status}
        isPulling={isPulling}
        threshold={threshold}
      />
      <div className="space-y-5 relative z-10" style={contentStyle}>
        {displayedClusters.map((cluster: any) => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}

        {hasMore && (
          <div className="pt-4 pb-8 text-center">
            <button
              onClick={handleLoadMore}
              disabled={result.fetching}
              className="w-full px-8 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-900 hover:text-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all border border-gray-300 hover:border-gray-900 disabled:border-gray-200"
            >
              {result.fetching ? 'Loading...' : 'Load more'}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              No infinite scroll here, you decide if you want more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
