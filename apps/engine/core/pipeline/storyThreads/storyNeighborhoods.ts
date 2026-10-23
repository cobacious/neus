import { cosineSimilarity } from '../utils';
export { CandidateClusterForMerge } from '../../../lib/typesafeClient';

export type CandidateStory = {
  id: string;
  title: string;
  status: string;
  overview: string | null;
  updatedAt?: Date | string;
  _count?: { clusters: number };
};

export type ClusterWithEmbedding = {
  id: string;
  headline?: string | null;
  summary?: string | null;
  createdAt: Date;
  storyId?: string | null;
  storyAngle?: string | null;
  embedding?: unknown;
  _count?: { articleAssignments: number };
  articleAssignments?: Array<{ createdAt: Date }>;
  [key: string]: any;
};

/**
 * Checks whether a candidate neighborhood represents an already-settled story.
 * If all clusters already belong to the same existing story, have assigned threads,
 * and have not had new clusters or articles added in the past RECENT_ACTIVITY_HOURS,
 * LLM evaluation and realignment can be safely skipped.
 */
export function isSettledNeighborhood<T extends ClusterWithEmbedding>(
  neighborhood: T[],
  existingStories: Array<{
    id: string;
    title: string;
    status: string;
    overview: string | null;
    updatedAt?: Date | string;
    _count?: { clusters: number };
  }>,
  activityCutoff: Date,
  activeStoryClusterCounts?: Map<string, number>
): { settled: boolean; storyTitle?: string } {
  if (neighborhood.length < 2) return { settled: false };

  // All clusters in the candidate neighborhood must already belong to a story
  if (!neighborhood.every((c) => Boolean(c.storyId))) {
    return { settled: false };
  }

  // All clusters must belong to the exact same story
  const targetStoryId = neighborhood[0].storyId!;
  if (!neighborhood.every((c) => c.storyId === targetStoryId)) {
    return { settled: false };
  }

  // All clusters must already have an assigned thread (stored in storyAngle column)
  if (!neighborhood.every((c) => Boolean(c.storyAngle))) {
    return { settled: false };
  }

  // Verify the story exists in existingStories
  const matchedStory = existingStories.find((s) => s.id === targetStoryId);
  if (!matchedStory) {
    return { settled: false };
  }

  // If the story has more active clusters in the current evaluation window than are present in this neighborhood,
  // do not treat as settled (a thread might be dissociated or split into another neighborhood).
  // Uses activeStoryClusterCounts if provided, falling back to matchedStory._count.clusters for unit tests.
  const totalStoryClusters = activeStoryClusterCounts
    ? (activeStoryClusterCounts.get(targetStoryId) ?? neighborhood.length)
    : (matchedStory._count?.clusters ?? neighborhood.length);

  if (totalStoryClusters > neighborhood.length) {
    return { settled: false };
  }

  // If matchedStory has an updatedAt timestamp, check if any cluster was created after the story was last organized
  if (matchedStory.updatedAt) {
    const storyUpdatedMs = new Date(matchedStory.updatedAt).getTime();
    const hasNewClusterSinceUpdate = neighborhood.some(
      (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
    );
    if (hasNewClusterSinceUpdate) {
      return { settled: false };
    }
    return { settled: true, storyTitle: matchedStory.title };
  }

  // Fallback when story.updatedAt is not provided (e.g. minimal unit tests):
  // Check if any cluster in the neighborhood was created recently (< 48h)
  const hasRecentlyCreatedCluster = neighborhood.some(
    (c) => new Date(c.createdAt) >= activityCutoff
  );
  if (hasRecentlyCreatedCluster) {
    return { settled: false };
  }

  // Check if any cluster in the neighborhood received a new article assignment recently (< 48h)
  const hasRecentlyAssignedArticle = neighborhood.some((c) => {
    const latestArticleAt = c.articleAssignments?.[0]?.createdAt;
    return latestArticleAt && new Date(latestArticleAt) >= activityCutoff;
  });
  if (hasRecentlyAssignedArticle) {
    return { settled: false };
  }

  return { settled: true, storyTitle: matchedStory.title };
}

/**
 * Groups clusters into candidate neighborhoods using vector similarity and connected components.
 * Standalone clusters (degree 0) are excluded.
 */
export function buildNeighborhoods<T extends ClusterWithEmbedding>(
  clusters: T[],
  similarityThreshold: number = 0.78,
  maxNeighborhoodSize: number = 6
): T[][] {
  const validClusters = clusters.filter(
    (c) => Array.isArray(c.embedding) && (c.embedding as number[]).length > 0
  );

  const n = validClusters.length;
  if (n < 2) return [];

  const adj = new Map<number, number[]>();
  for (let i = 0; i < n; i++) adj.set(i, []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(
        validClusters[i].embedding as number[],
        validClusters[j].embedding as number[]
      );
      if (sim >= similarityThreshold) {
        adj.get(i)!.push(j);
        adj.get(j)!.push(i);
      }
    }
  }

  const visited = new Set<number>();
  const neighborhoods: T[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;

    const componentIndices: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      componentIndices.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (componentIndices.length >= 2) {
      const component = componentIndices.map((idx) => validClusters[idx]);
      if (component.length > maxNeighborhoodSize && similarityThreshold < 0.86) {
        // Tighten similarity threshold to break transitive chaining across distinct stories
        const subComponents = buildNeighborhoods(
          component,
          similarityThreshold + 0.04,
          maxNeighborhoodSize
        );
        neighborhoods.push(...subComponents);
      } else if (component.length > maxNeighborhoodSize) {
        // Slice into chunks of maxNeighborhoodSize
        for (let s = 0; s < component.length; s += maxNeighborhoodSize) {
          const chunk = component.slice(s, s + maxNeighborhoodSize);
          if (chunk.length >= 2) neighborhoods.push(chunk);
        }
      } else {
        neighborhoods.push(component);
      }
    }
  }

  return neighborhoods;
}

export function computeCentroidEmbedding(clusters: ClusterWithEmbedding[]): number[] | null {
  const validEmbeddings = clusters
    .map((c) => c.embedding)
    .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

  if (validEmbeddings.length === 0) return null;

  const dim = validEmbeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const emb of validEmbeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= validEmbeddings.length;
  }

  return centroid;
}

export function findCandidateStoriesForNeighborhood(
  neighborhood: ClusterWithEmbedding[],
  existingStories: Array<{
    id: string;
    title: string;
    status: string;
    overview: string | null;
    embedding?: unknown;
  }>
): CandidateStory[] {
  const candidateMap = new Map<string, CandidateStory>();

  // 1. Check if any cluster in neighborhood already belongs to a story
  for (const c of neighborhood) {
    if (c.storyId) {
      const match = existingStories.find((s) => s.id === c.storyId);
      if (match) {
        candidateMap.set(match.id, {
          id: match.id,
          title: match.title,
          status: match.status,
          overview: match.overview,
          _count: (match as any)._count,
        });
      }
    }
  }

  // 2. Vector search: check if any cluster centroid has cosine similarity >= 0.74 with an existing story embedding
  for (const story of existingStories) {
    if (candidateMap.has(story.id)) continue;
    if (!Array.isArray(story.embedding) || (story.embedding as number[]).length === 0) continue;

    for (const c of neighborhood) {
      if (Array.isArray(c.embedding) && (c.embedding as number[]).length > 0) {
        const sim = cosineSimilarity(c.embedding as number[], story.embedding as number[]);
        if (sim >= 0.74) {
          candidateMap.set(story.id, {
            id: story.id,
            title: story.title,
            status: story.status,
            overview: story.overview,
            _count: (story as any)._count,
          });
          break;
        }
      }
    }
  }

  return Array.from(candidateMap.values());
}
