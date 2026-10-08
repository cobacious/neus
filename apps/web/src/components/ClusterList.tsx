import { useState, useEffect } from 'react';
import { useQuery } from 'urql';
import ClusterCard from './ClusterCard';
import ClusterCardSkeleton from './ClusterCardSkeleton';
import Loading from './Loading';

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
        }
      }
    }
    clusterCount
  }
`;

function deduplicateClustersByStory(clusters: any[]): any[] {
  const seenStoryIds = new Set<string>();
  const result: any[] = [];
  for (const c of clusters) {
    if (c.storyId) {
      if (seenStoryIds.has(c.storyId)) {
        continue;
      }
      seenStoryIds.add(c.storyId);
    }
    result.push(c);
  }
  return result;
}

const CLUSTERS_PER_PAGE = 15;

export default function ClusterList() {
  const [displayedClusters, setDisplayedClusters] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);

  const [result] = useQuery({
    query: CLUSTERS_QUERY,
    variables: { limit: CLUSTERS_PER_PAGE, offset },
    requestPolicy: 'cache-and-network',
  });

  // Update displayed clusters when new data arrives
  useEffect(() => {
    if (result.data && !result.fetching) {
      const rawClusters = result.data.clusters || [];
      if (offset === 0) {
        // Initial load
        setDisplayedClusters(deduplicateClustersByStory(rawClusters));
      } else if (rawClusters.length > 0) {
        // Loading more - append new clusters and deduplicate
        setDisplayedClusters((prev) => {
          const combined = [...prev, ...rawClusters];
          const existingIds = new Set<string>();
          const seenStoryIds = new Set<string>();
          const deduped: any[] = [];
          for (const c of combined) {
            if (existingIds.has(c.id)) continue;
            if (c.storyId && seenStoryIds.has(c.storyId)) continue;
            existingIds.add(c.id);
            if (c.storyId) seenStoryIds.add(c.storyId);
            deduped.push(c);
          }
          return deduped;
        });
      }
    }
  }, [result.data, result.fetching, offset]);

  const handleLoadMore = () => {
    setOffset(displayedClusters.length);
  };

  // Initial loading state
  if (result.fetching && displayedClusters.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <ClusterCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (result.error) {
    return <p className="text-center">Error loading clusters</p>;
  }

  const totalClusters = result.data?.clusterCount ?? 0;
  const hasMore = displayedClusters.length < totalClusters;

  return (
    <div className="space-y-4">
      {displayedClusters.map((cluster: any) => (
        <ClusterCard key={cluster.id} cluster={cluster} />
      ))}

      {hasMore && (
        <div className="pt-4 pb-8">
          <button
            onClick={handleLoadMore}
            disabled={result.fetching}
            className="w-full px-8 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-900 hover:text-white disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all border border-gray-300 hover:border-gray-900 disabled:border-gray-200"
          >
            {result.fetching ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
