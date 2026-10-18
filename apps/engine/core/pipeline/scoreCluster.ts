export type ScoredClusterArticle = {
  article: {
    publishedAt: Date;
    sourceId: string;
    sourceRel?: { trustScore?: number } | null;
  };
};

export type ScorableCluster = {
  articleAssignments: ScoredClusterArticle[];
  story?: {
    clusters?: Array<{ id: string }>;
  } | null;
  storyAngleCount?: number;
};

const HOUR_MS = 1000 * 60 * 60;
export const HALF_LIFE_HOURS = process.env.CLUSTER_SCORE_HALF_LIFE_HOURS
  ? parseFloat(process.env.CLUSTER_SCORE_HALF_LIFE_HOURS)
  : 28; // 28-hour half-life balances 24h story retention with day-2 turnover

export function scoreCluster(cluster: ScorableCluster, now: number = Date.now()): number {
  const assignments = cluster.articleAssignments;
  if (!assignments || assignments.length === 0) return 0;

  const sourceLatestMap = new Map<string, number>();
  const sourceTrustMap = new Map<string, number>();

  for (const a of assignments) {
    const sId = a.article.sourceId;
    const time = a.article.publishedAt.getTime();
    const prevTime = sourceLatestMap.get(sId);
    if (!prevTime || time > prevTime) {
      sourceLatestMap.set(sId, time);
    }
    if (!sourceTrustMap.has(sId)) {
      sourceTrustMap.set(sId, a.article.sourceRel?.trustScore ?? 0.5);
    }
  }

  // Consensus Recency:
  // For multi-source clusters, use the 2nd newest source timestamp to establish consensus recency.
  // This prevents a single outlet from resetting the clock with high-frequency follow-up churn.
  const sortedSourceTimes = Array.from(sourceLatestMap.values()).sort((a, b) => b - a);
  const consensusLatest =
    sortedSourceTimes.length >= 2 ? sortedSourceTimes[1] : sortedSourceTimes[0];

  const hoursSince = Math.max(0, (now - consensusLatest) / HOUR_MS);

  // Exponential recency decay so older clusters decay smoothly towards 0
  const recency = Math.exp(-hoursSince / HALF_LIFE_HOURS);

  // 1. Source breadth with expanded dynamic range
  const uniqueSources = sourceLatestMap.size;
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
