import { cosineSimilarity } from '../pipeline/utils';

export interface PulseArticle {
  id: string;
  title: string;
  sourceId: string;
  publishedAt: Date;
  embedding?: number[] | null;
}

export interface PulseConfig {
  cooldownMinutes?: number; // default: 60
  batchArticleThreshold?: number; // default: 45
  heartbeatStalenessHours?: number; // default: 6
  surgeSourceThreshold?: number; // default: 3
  surgeWindowMinutes?: number; // default: 45
  surgeSimilarityThreshold?: number; // default: 0.88
}

export interface PulseTriggerInput {
  isRunInProgress: boolean;
  minutesSinceLastRun: number;
  unclusteredArticleCount: number;
  recentArticles: PulseArticle[];
  now?: number;
  config?: PulseConfig;
}

export type PulseTriggerReason =
  | 'run_in_progress'
  | 'cooldown_active'
  | 'breaking_surge'
  | 'batch_threshold'
  | 'heartbeat_staleness'
  | 'insufficient_activity';

export interface PulseSurgeCluster {
  uniqueSources: number;
  articleCount: number;
  titles: string[];
  sourceIds: string[];
}

export interface PulseTriggerResult {
  shouldTrigger: boolean;
  reason: PulseTriggerReason;
  surgeCluster?: PulseSurgeCluster;
  metrics: {
    minutesSinceLastRun: number;
    unclusteredArticleCount: number;
    recentArticleCount: number;
  };
}

export function findSurgeCluster(
  articles: PulseArticle[],
  surgeSourceThreshold: number,
  surgeSimilarityThreshold: number
): PulseSurgeCluster | undefined {
  // Only compare articles that have vector embeddings
  const embedded = articles.filter(
    (a) => Array.isArray(a.embedding) && a.embedding.length > 0
  );
  if (embedded.length < surgeSourceThreshold) return undefined;

  // Build Adjacency List for pairwise similarity >= threshold
  const adj: Map<number, number[]> = new Map();
  for (let i = 0; i < embedded.length; i++) {
    adj.set(i, []);
  }

  for (let i = 0; i < embedded.length; i++) {
    const embA = embedded[i].embedding as number[];
    for (let j = i + 1; j < embedded.length; j++) {
      const embB = embedded[j].embedding as number[];
      const sim = cosineSimilarity(embA, embB);
      if (sim >= surgeSimilarityThreshold) {
        adj.get(i)!.push(j);
        adj.get(j)!.push(i);
      }
    }
  }

  // Find connected components using DFS traversal
  const visited = new Set<number>();
  let bestSurge: PulseSurgeCluster | undefined;

  for (let i = 0; i < embedded.length; i++) {
    if (visited.has(i)) continue;

    const componentIndices: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.pop()!;
      componentIndices.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const componentArticles = componentIndices.map((idx) => embedded[idx]);
    const uniqueSources = new Set(componentArticles.map((a) => a.sourceId));

    if (uniqueSources.size >= surgeSourceThreshold) {
      if (!bestSurge || uniqueSources.size > bestSurge.uniqueSources) {
        bestSurge = {
          uniqueSources: uniqueSources.size,
          articleCount: componentArticles.length,
          titles: componentArticles.map((a) => a.title),
          sourceIds: Array.from(uniqueSources),
        };
      }
    }
  }

  return bestSurge;
}

export function evaluatePulseTrigger(input: PulseTriggerInput): PulseTriggerResult {
  const {
    isRunInProgress,
    minutesSinceLastRun,
    unclusteredArticleCount,
    recentArticles,
    now = Date.now(),
    config = {},
  } = input;

  const cooldownMinutes = config.cooldownMinutes ?? 60;
  const batchArticleThreshold = config.batchArticleThreshold ?? 45;
  const heartbeatStalenessHours = config.heartbeatStalenessHours ?? 6;
  const surgeSourceThreshold = config.surgeSourceThreshold ?? 3;
  const surgeWindowMinutes = config.surgeWindowMinutes ?? 45;
  const surgeSimilarityThreshold = config.surgeSimilarityThreshold ?? 0.88;

  const metrics = {
    minutesSinceLastRun,
    unclusteredArticleCount,
    recentArticleCount: recentArticles.length,
  };

  // 1. Safety Guard: Never trigger concurrent pipeline runs
  if (isRunInProgress) {
    return { shouldTrigger: false, reason: 'run_in_progress', metrics };
  }

  // 2. Safety Guard: Enforce minimum cooldown period after previous run
  if (minutesSinceLastRun < cooldownMinutes) {
    return { shouldTrigger: false, reason: 'cooldown_active', metrics };
  }

  // 3. Emergency Surge Check: Detect multi-source breaking news events
  const surgeCutoffMs = now - surgeWindowMinutes * 60 * 1000;
  const surgeWindowArticles = recentArticles.filter(
    (a) => a.publishedAt.getTime() >= surgeCutoffMs
  );

  const surgeCluster = findSurgeCluster(
    surgeWindowArticles,
    surgeSourceThreshold,
    surgeSimilarityThreshold
  );

  if (surgeCluster) {
    return {
      shouldTrigger: true,
      reason: 'breaking_surge',
      surgeCluster,
      metrics,
    };
  }

  // 4. Batch Accumulation Trigger: Routine news volume threshold reached
  if (unclusteredArticleCount >= batchArticleThreshold) {
    return { shouldTrigger: true, reason: 'batch_threshold', metrics };
  }

  // 5. Heartbeat Staleness Guard: Maintenance run when too much time has elapsed
  if (minutesSinceLastRun >= heartbeatStalenessHours * 60) {
    return { shouldTrigger: true, reason: 'heartbeat_staleness', metrics };
  }

  // 6. Default: Quiet news cycle, wait for next pulse
  return { shouldTrigger: false, reason: 'insufficient_activity', metrics };
}
