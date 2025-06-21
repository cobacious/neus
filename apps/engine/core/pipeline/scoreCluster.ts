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

export function scoreCluster(cluster: ScorableCluster): number {
  if (!cluster.articleAssignments || cluster.articleAssignments.length === 0) return 0;

  const latest = Math.max(
    ...cluster.articleAssignments.map((a) => a.article.publishedAt.getTime())
  );
  const hoursSince = (Date.now() - latest) / HOUR_MS;
  const recency = 1 / (1 + hoursSince);

  const sourceIds = new Set(cluster.articleAssignments.map((a) => a.article.sourceId));
  const coverage = Math.sqrt(sourceIds.size);

  const trustScores = cluster.articleAssignments.map(
    (a) => a.article.sourceRel?.trustScore ?? 0
  );
  const avgTrust = trustScores.reduce((sum, v) => sum + v, 0) / trustScores.length;

  const score = recency * 0.4 + coverage * 0.3 + avgTrust * 0.3;
  return score;
}
