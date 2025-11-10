import { prisma } from '../client';

/**
 * Fetches recent clusters with their embeddings for matching new articles.
 *
 * Only fetches clusters created in the last N days to prevent checking
 * against stale/old clusters that are unlikely to match new articles.
 *
 * @param daysBack - Number of days to look back (default: 7)
 */
export async function getRecentClustersWithEmbeddings(daysBack: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return prisma.cluster.findMany({
    where: {
      createdAt: {
        gte: cutoffDate,
      },
      embedding: {
        not: { equals: null },
      },
    },
    select: {
      id: true,
      embedding: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
