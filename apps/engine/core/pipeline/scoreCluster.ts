export type ScoredClusterArticle = {
  article: {
    publishedAt: Date;
    sourceId: string;
    sourceRel?: { trustScore?: number } | null;
  };
};

export type ScorableCluster = {
  id?: string;
  storyId?: string | null;
  articleAssignments: ScoredClusterArticle[];
  story?: {
    id?: string;
    clusters?: Array<{ id: string }>;
  } | null;
  storyAngleCount?: number;
  storyClusters?: ScorableCluster[];
};

const HOUR_MS = 1000 * 60 * 60;
export const HALF_LIFE_HOURS = process.env.CLUSTER_SCORE_HALF_LIFE_HOURS
  ? parseFloat(process.env.CLUSTER_SCORE_HALF_LIFE_HOURS)
  : 28; // 28-hour half-life balances 24h story retention with day-2 turnover

export const FRESHNESS_WINDOW_HOURS = process.env.CLUSTER_SCORE_FRESHNESS_HOURS
  ? parseFloat(process.env.CLUSTER_SCORE_FRESHNESS_HOURS)
  : 4; // Configurable freshness plateau neutralises cron timing differences

export function scoreCluster(
  cluster: ScorableCluster,
  now: number = Date.now(),
  storyClustersParam?: ScorableCluster[]
): number {
  const assignments = cluster.articleAssignments;
  if (!assignments || assignments.length === 0) return 0;

  const storyClusters = storyClustersParam ?? cluster.storyClusters;

  // Multi-Angle Story Score Roll-up:
  // When a cluster belongs to an active story with multiple angles, pool sources and articles
  // across all member clusters in the story so the story's true macro-breadth and volume are recognized.
  if (storyClusters && storyClusters.length > 1) {
    const storySourceLatestMap = new Map<string, number>();
    const storySourceTrustMap = new Map<string, number>();
    let totalStoryArticles = 0;
    let maxClusterArticles = 0;

    for (const sc of storyClusters) {
      const count = sc.articleAssignments ? sc.articleAssignments.length : 0;
      if (count > maxClusterArticles) {
        maxClusterArticles = count;
      }
      totalStoryArticles += count;

      for (const a of sc.articleAssignments || []) {
        if (!a.article?.publishedAt) continue;
        const sId = a.article.sourceId;
        const time =
          a.article.publishedAt instanceof Date
            ? a.article.publishedAt.getTime()
            : new Date(a.article.publishedAt).getTime();
        const prev = storySourceLatestMap.get(sId);
        if (!prev || time > prev) {
          storySourceLatestMap.set(sId, time);
        }
        if (!storySourceTrustMap.has(sId)) {
          storySourceTrustMap.set(sId, a.article.sourceRel?.trustScore ?? 0.5);
        }
      }
    }

    const uniqueSources = storySourceLatestMap.size;
    if (uniqueSources === 0) return 0;

    // 1. Story coverage breadth across all member angles
    const coverage = Math.pow(uniqueSources, 0.75);

    // 2. Average trust across all unique outlets covering the story
    const trustValues = Array.from(storySourceTrustMap.values());
    const avgTrust = trustValues.reduce((sum, v) => sum + v, 0) / (trustValues.length || 1);
    const trustFactor = 0.35 + 0.65 * avgTrust;

    // 3. Sub-linear article volume boost across the whole story, capped at 2.5 * story unique sources
    const effectiveArticles = Math.min(totalStoryArticles, 2.5 * uniqueSources);
    const volumeFactor = 1 + 0.12 * Math.log(Math.max(1, effectiveArticles));

    // 4. Story umbrella multiplier for multi-angle complexity
    const angleCount = storyClusters.length;
    const umbrellaFactor = 1 + Math.min(0.20, 0.08 * (angleCount - 1));

    const storyBaseScore = coverage * volumeFactor * trustFactor * umbrellaFactor;

    // 5. Cluster angle weighting: primary (largest) angle receives 100% of story base score;
    // secondary angles receive proportional weight down to a floor of 85%
    const clusterArticles = cluster.articleAssignments ? cluster.articleAssignments.length : 0;
    const angleWeight = 0.85 + 0.15 * (clusterArticles / Math.max(1, maxClusterArticles));

    // 6. Consensus recency:
    const clusterSourceMap = new Map<string, number>();
    for (const a of cluster.articleAssignments || []) {
      if (!a.article?.publishedAt) continue;
      const sId = a.article.sourceId;
      const time =
        a.article.publishedAt instanceof Date
          ? a.article.publishedAt.getTime()
          : new Date(a.article.publishedAt).getTime();
      const prev = clusterSourceMap.get(sId);
      if (!prev || time > prev) {
        clusterSourceMap.set(sId, time);
      }
    }

    const cS = clusterSourceMap.size;
    const sortedTimes = Array.from(
      (cS >= 2 ? clusterSourceMap : storySourceLatestMap).values()
    ).sort((a, b) => b - a);
    const consensusIndex =
      sortedTimes.length >= 2
        ? Math.min(sortedTimes.length - 1, Math.max(1, Math.floor(sortedTimes.length / 3)))
        : 0;
    const consensusLatest = sortedTimes[consensusIndex];

    const hoursSince = Math.max(0, (now - consensusLatest) / HOUR_MS);
    const decayHours = Math.max(0, hoursSince - FRESHNESS_WINDOW_HOURS);
    const recency = Math.exp(-decayHours / HALF_LIFE_HOURS);

    return storyBaseScore * angleWeight * recency;
  }

  const sourceLatestMap = new Map<string, number>();
  const sourceTrustMap = new Map<string, number>();

  for (const a of assignments) {
    const sId = a.article.sourceId;
    const time =
      a.article.publishedAt instanceof Date
        ? a.article.publishedAt.getTime()
        : new Date(a.article.publishedAt).getTime();
    const prevTime = sourceLatestMap.get(sId);
    if (!prevTime || time > prevTime) {
      sourceLatestMap.set(sId, time);
    }
    if (!sourceTrustMap.has(sId)) {
      sourceTrustMap.set(sId, a.article.sourceRel?.trustScore ?? 0.5);
    }
  }

  // Consensus Recency:
  // Prevent single-source churn from resetting the recency clock while ensuring broad stories
  // require meaningful consensus rather than a single straggler.
  // For 2-5 sources: requires the 2nd newest source.
  // For 6-8 sources: requires the 3rd newest source (top 1/3).
  // For 9+ sources: requires at least the top tercile (Math.floor(uniqueSources / 3)).
  const uniqueSources = sourceLatestMap.size;
  const sortedSourceTimes = Array.from(sourceLatestMap.values()).sort((a, b) => b - a);
  const consensusIndex =
    sortedSourceTimes.length >= 2
      ? Math.min(sortedSourceTimes.length - 1, Math.max(1, Math.floor(uniqueSources / 3)))
      : 0;
  const consensusLatest = sortedSourceTimes[consensusIndex];

  const hoursSince = Math.max(0, (now - consensusLatest) / HOUR_MS);

  // Exponential recency decay begins only after the freshness grace period has elapsed.
  // This ensures stories breaking anytime within the cron cycle enter the feed with recency = 1.0.
  const decayHours = Math.max(0, hoursSince - FRESHNESS_WINDOW_HOURS);
  const recency = Math.exp(-decayHours / HALF_LIFE_HOURS);

  // 1. Source breadth with expanded dynamic range
  const coverage = Math.pow(uniqueSources, 0.75);

  // 2. Multiplicative trust normalized to [0.55, 1.00]
  const trustValues = Array.from(sourceTrustMap.values());
  const avgTrust = trustValues.reduce((sum, v) => sum + v, 0) / (trustValues.length || 1);
  const trustFactor = 0.35 + 0.65 * avgTrust;

  // 3. Sub-linear article volume boost, strictly capped at 2.5 * uniqueSources to prevent single-source gaming
  const rawArticleCount = assignments.length;
  const effectiveArticles = Math.min(rawArticleCount, 2.5 * uniqueSources);
  const volumeFactor = 1 + 0.12 * Math.log(Math.max(1, effectiveArticles));

  // 4. Story umbrella multiplier for multi-angle events
  const angleCount = cluster.storyAngleCount ?? cluster.story?.clusters?.length ?? 1;
  const umbrellaFactor = angleCount > 1 ? 1 + Math.min(0.20, 0.08 * (angleCount - 1)) : 1.0;

  const baseScore = coverage * volumeFactor * trustFactor * umbrellaFactor;

  // Final score is base quality scaled by exponential consensus recency decay
  return baseScore * recency;
}
