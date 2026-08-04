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
const HALF_LIFE_HOURS = 72; // 3-day half-life for exponential recency decay

export function scoreCluster(cluster: ScorableCluster, now: number = Date.now()): number {
  if (!cluster.articleAssignments || cluster.articleAssignments.length === 0) return 0;

  const latest = Math.max(
    ...cluster.articleAssignments.map((a) => a.article.publishedAt.getTime())
  );
  const hoursSince = Math.max(0, (now - latest) / HOUR_MS);

  // Exponential recency decay so older clusters decay smoothly towards 0
  const recency = Math.exp(-hoursSince / HALF_LIFE_HOURS);

  const sourceIds = new Set(cluster.articleAssignments.map((a) => a.article.sourceId));
  const coverage = Math.sqrt(sourceIds.size);

  const trustScores = cluster.articleAssignments.map(
    (a) => a.article.sourceRel?.trustScore ?? 0
  );
  const avgTrust = trustScores.reduce((sum, v) => sum + v, 0) / (trustScores.length || 1);

  // Base quality score combines source coverage breadth and source trust score
  const baseScore = coverage * 0.5 + avgTrust * 0.5;

  // Final score is base quality scaled by exponential recency decay
  return baseScore * recency;
}
