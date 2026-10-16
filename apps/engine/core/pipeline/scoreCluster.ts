export type ScoredClusterArticle = {
  article: {
    publishedAt: Date;
    sourceId: string;
    sourceRel?: { trustScore?: number } | null;
  };
};

export type ScorableCluster = {
  articleAssignments: ScoredClusterArticle[];
};

const HOUR_MS = 1000 * 60 * 60;
export const HALF_LIFE_HOURS = process.env.CLUSTER_SCORE_HALF_LIFE_HOURS
  ? parseFloat(process.env.CLUSTER_SCORE_HALF_LIFE_HOURS)
  : 24; // 24-hour half-life for exponential recency decay (down from 72h)

export function scoreCluster(cluster: ScorableCluster, now: number = Date.now()): number {
  if (!cluster.articleAssignments || cluster.articleAssignments.length === 0) return 0;

  const sourceLatestMap = new Map<string, number>();
  const sourceTrustMap = new Map<string, number>();

  for (const a of cluster.articleAssignments) {
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

  // Coverage is scaled by unique source count
  const coverage = Math.sqrt(sourceLatestMap.size);

  // Trust is averaged across unique sources rather than raw articles to prevent spam dilution
  const trustValues = Array.from(sourceTrustMap.values());
  const avgTrust = trustValues.reduce((sum, v) => sum + v, 0) / (trustValues.length || 1);

  // Base quality score combines source coverage breadth and source editorial trust
  const baseScore = coverage * 0.5 + avgTrust * 0.5;

  // Final score is base quality scaled by exponential consensus recency decay
  return baseScore * recency;
}
