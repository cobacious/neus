import { prisma } from '../client';

/**
 * Counts unclustered articles created within the lookback window.
 * Default lookback is 3 days to match getUnclusteredArticles.
 */
export async function countUnclusteredArticles(daysBack = 3): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return prisma.article.count({
    where: {
      clusterAssignments: { none: {} },
      createdAt: { gte: cutoffDate },
    },
  });
}
