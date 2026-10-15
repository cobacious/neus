import fs from 'fs';
import path from 'path';
import { buildNeighborhoods } from '../core/pipeline/organizeStoryAngles';
import type { ClusterWithEmbedding } from '../core/pipeline/organizeStoryAngles';

interface SnapshotData {
  activeClusters: ClusterWithEmbedding[];
  stories: Array<{
    id: string;
    title: string;
    slug?: string;
    overview: string | null;
    status: string;
    updatedAt?: string | Date;
    createdAt?: string | Date;
    _count?: { clusters: number };
  }>;
}

function loadSnapshot(): SnapshotData {
  const fixturePath = path.resolve(__dirname, '../fixtures/production-cluster-topology.json');
  if (fs.existsSync(fixturePath)) {
    return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  }
  throw new Error(`Fixture not found at ${fixturePath}. Run export script first.`);
}

interface SimulationResult {
  strategyName: string;
  totalNeighborhoods: number;
  skippedInactive: number;
  skippedSettled: number;
  evaluatedNeighborhoods: number;
  simulatedArticleBatches: number;
  totalLlmCalls: number;
  estimatedLatencySeconds: number;
}

export function runSimulation(): Record<string, SimulationResult> {
  const { activeClusters, stories } = loadSnapshot();
  const neighborhoods = buildNeighborhoods(activeClusters, 0.78);

  const activeStoryClusterCounts = new Map<string, number>();
  for (const c of activeClusters) {
    if (c.storyId) {
      activeStoryClusterCounts.set(c.storyId, (activeStoryClusterCounts.get(c.storyId) || 0) + 1);
    }
  }

  const now = Date.now();
  const cutoff48h = new Date(now - 48 * 3600 * 1000);

  // Strategy 1: Current Production Logic
  // Uses 48h activity check and current isSettledNeighborhood
  let s1Inactive = 0;
  let s1Settled = 0;
  let s1Evaluated = 0;
  let s1Batches = 0;

  for (const n of neighborhoods) {
    const hasActivity = n.some((c) => {
      const isNew = new Date(c.createdAt) >= cutoff48h;
      const latestArticle = c.articleAssignments?.[0]?.createdAt;
      return isNew || (latestArticle && new Date(latestArticle) >= cutoff48h);
    });

    if (!hasActivity) {
      s1Inactive++;
      continue;
    }

    // Current isSettledNeighborhood logic
    const allHaveStory = n.every((c) => Boolean(c.storyId));
    const targetStoryId = n[0]?.storyId;
    const sameStory = allHaveStory && n.every((c) => c.storyId === targetStoryId);
    const allHaveAngle = n.every((c) => Boolean(c.storyAngle));
    const matchedStory = targetStoryId ? stories.find((s) => s.id === targetStoryId) : null;
    const totalStoryClusters = targetStoryId
      ? activeStoryClusterCounts.get(targetStoryId) ?? n.length
      : 0;

    let isSettled = false;
    if (sameStory && allHaveAngle && matchedStory && totalStoryClusters <= n.length) {
      const hasRecentCluster = n.some((c) => new Date(c.createdAt) >= cutoff48h);
      const hasRecentArticle = n.some((c) => {
        const at = c.articleAssignments?.[0]?.createdAt;
        return at && new Date(at) >= cutoff48h;
      });
      if (!hasRecentCluster && !hasRecentArticle) {
        isSettled = true;
      }
    }

    if (isSettled) {
      s1Settled++;
      continue;
    }

    s1Evaluated++;
    // In current prod, every evaluated story that has articles in 48h gets article classification
    const articleCount = n.reduce((sum, c) => sum + (c._count?.articleAssignments ?? 0), 0);
    s1Batches += Math.ceil(articleCount / 25);
  }

  // Strategy 2: Delta against story.updatedAt (Skip re-evaluating settled stories unless new clusters arrived)
  // Story is settled if all clusters belong to same story, all have angles, and no cluster created after story.updatedAt
  let s2Inactive = 0;
  let s2Settled = 0;
  let s2Evaluated = 0;
  let s2Batches = 0;

  for (const n of neighborhoods) {
    const hasActivity = n.some((c) => {
      const isNew = new Date(c.createdAt) >= cutoff48h;
      const latestArticle = c.articleAssignments?.[0]?.createdAt;
      return isNew || (latestArticle && new Date(latestArticle) >= cutoff48h);
    });

    if (!hasActivity) {
      s2Inactive++;
      continue;
    }

    const allHaveStory = n.every((c) => Boolean(c.storyId));
    const targetStoryId = n[0]?.storyId;
    const sameStory = allHaveStory && n.every((c) => c.storyId === targetStoryId);
    const allHaveAngle = n.every((c) => Boolean(c.storyAngle));
    const matchedStory = targetStoryId ? stories.find((s) => s.id === targetStoryId) : null;
    const totalStoryClusters = targetStoryId
      ? activeStoryClusterCounts.get(targetStoryId) ?? n.length
      : 0;

    let isSettled = false;
    if (sameStory && allHaveAngle && matchedStory && totalStoryClusters <= n.length) {
      const storyUpdatedMs = matchedStory.updatedAt ? new Date(matchedStory.updatedAt).getTime() : 0;
      // 60-second tolerance for transaction timestamp differences
      const hasNewClusterSinceUpdate = n.some(
        (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
      );

      if (!hasNewClusterSinceUpdate) {
        isSettled = true;
      }
    }

    if (isSettled) {
      s2Settled++;
      continue;
    }

    s2Evaluated++;
    // Only run article classification when angles change or new story created
    // For newly formed stories or altered angle count:
    const isNewStory = !targetStoryId;
    const hadAngleChange = matchedStory && (matchedStory._count?.clusters ?? 0) !== n.length;
    if (isNewStory || hadAngleChange) {
      const articleCount = n.reduce((sum, c) => sum + (c._count?.articleAssignments ?? 0), 0);
      s2Batches += Math.ceil(articleCount / 25);
    }
  }

  // Strategy 3: Tighter Recency Window (24h) + Delta settled check
  const cutoff24h = new Date(now - 24 * 3600 * 1000);
  let s3Inactive = 0;
  let s3Settled = 0;
  let s3Evaluated = 0;
  let s3Batches = 0;

  for (const n of neighborhoods) {
    const hasActivity = n.some((c) => {
      const isNew = new Date(c.createdAt) >= cutoff24h;
      const latestArticle = c.articleAssignments?.[0]?.createdAt;
      return isNew || (latestArticle && new Date(latestArticle) >= cutoff24h);
    });

    if (!hasActivity) {
      s3Inactive++;
      continue;
    }

    const allHaveStory = n.every((c) => Boolean(c.storyId));
    const targetStoryId = n[0]?.storyId;
    const sameStory = allHaveStory && n.every((c) => c.storyId === targetStoryId);
    const allHaveAngle = n.every((c) => Boolean(c.storyAngle));
    const matchedStory = targetStoryId ? stories.find((s) => s.id === targetStoryId) : null;
    const totalStoryClusters = targetStoryId
      ? activeStoryClusterCounts.get(targetStoryId) ?? n.length
      : 0;

    let isSettled = false;
    if (sameStory && allHaveAngle && matchedStory && totalStoryClusters <= n.length) {
      const storyUpdatedMs = matchedStory.updatedAt ? new Date(matchedStory.updatedAt).getTime() : 0;
      const hasNewClusterSinceUpdate = n.some(
        (c) => new Date(c.createdAt).getTime() > storyUpdatedMs + 60000
      );

      if (!hasNewClusterSinceUpdate) {
        isSettled = true;
      }
    }

    if (isSettled) {
      s3Settled++;
      continue;
    }

    s3Evaluated++;
    const isNewStory = !targetStoryId;
    const hadAngleChange = matchedStory && (matchedStory._count?.clusters ?? 0) !== n.length;
    if (isNewStory || hadAngleChange) {
      const articleCount = n.reduce((sum, c) => sum + (c._count?.articleAssignments ?? 0), 0);
      s3Batches += Math.ceil(articleCount / 25);
    }
  }

  const results: Record<string, SimulationResult> = {
    '1_Current_Production': {
      strategyName: 'Current Production (48h activity + flawed settled check)',
      totalNeighborhoods: neighborhoods.length,
      skippedInactive: s1Inactive,
      skippedSettled: s1Settled,
      evaluatedNeighborhoods: s1Evaluated,
      simulatedArticleBatches: s1Batches,
      totalLlmCalls: s1Evaluated + s1Batches,
      estimatedLatencySeconds: (s1Evaluated + s1Batches) * 12,
    },
    '2_Delta_Settled_Check': {
      strategyName: 'Delta Settled Check (story.updatedAt comparison + 48h lookback)',
      totalNeighborhoods: neighborhoods.length,
      skippedInactive: s2Inactive,
      skippedSettled: s2Settled,
      evaluatedNeighborhoods: s2Evaluated,
      simulatedArticleBatches: s2Batches,
      totalLlmCalls: s2Evaluated + s2Batches,
      estimatedLatencySeconds: (s2Evaluated + s2Batches) * 12,
    },
    '3_Delta_Plus_24h_Window': {
      strategyName: 'Delta Settled Check + 24h Activity Window',
      totalNeighborhoods: neighborhoods.length,
      skippedInactive: s3Inactive,
      skippedSettled: s3Settled,
      evaluatedNeighborhoods: s3Evaluated,
      simulatedArticleBatches: s3Batches,
      totalLlmCalls: s3Evaluated + s3Batches,
      estimatedLatencySeconds: (s3Evaluated + s3Batches) * 12,
    },
  };

  return results;
}

if (require.main === module) {
  const results = runSimulation();
  console.log('\n================ PIPELINE SIMULATION RESULTS ================');
  console.table(
    Object.values(results).map((r) => ({
      Strategy: r.strategyName,
      'Total Groups': r.totalNeighborhoods,
      'Skipped Inactive': r.skippedInactive,
      'Skipped Settled': r.skippedSettled,
      'Evals (LLM)': r.evaluatedNeighborhoods,
      'Article Batches': r.simulatedArticleBatches,
      'Total LLM Calls': r.totalLlmCalls,
      'Est. Time (s)': r.estimatedLatencySeconds,
      'Est. Time (min)': (r.estimatedLatencySeconds / 60).toFixed(1),
    }))
  );
}
