import { prisma } from '../client';

/**
 * Permanently deletes unclustered articles older than maxAgeDays.
 *
 * Articles that remain unclustered after several days are no longer queried
 * by the clustering pipeline (which uses a recent cutoff window), and are never
 * displayed to users since the API/UI only serves clustered stories.
 *
 * Deleting these unclustered articles frees substantial storage by pruning
 * unused full content and vector embeddings.
 *
 * @param maxAgeDays - Age cutoff in days (default: 7)
 * @returns Number of articles deleted
 */
export async function deleteOldUnclusteredArticles(maxAgeDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const result = await prisma.article.deleteMany({
    where: {
      clusterAssignments: {
        none: {},
      },
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
