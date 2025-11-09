import { prisma } from '../client';

/**
 * Fetches unclustered articles that were created recently.
 *
 * Optimization: Only fetches articles from the last 3 days to prevent
 * O(n²) clustering comparisons from growing unbounded as old unclustered
 * articles accumulate.
 *
 * Articles that remain unclustered after 3 days likely won't find matches
 * with new articles anyway, so excluding them improves performance without
 * significant impact on clustering quality.
 *
 * @param daysBack - Number of days to look back (default: 3)
 */
export async function getUnclusteredArticles(daysBack: number = 3) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return prisma.article.findMany({
    where: {
      embedding: { not: { equals: null } },
      clusterAssignments: { none: {} },
      createdAt: {
        gte: cutoffDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
