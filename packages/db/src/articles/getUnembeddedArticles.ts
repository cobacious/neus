import { prisma } from '../client';
import { Prisma } from '@prisma/client';

/**
 * Fetches recent active articles missing embeddings.
 *
 * Optimizations:
 * - Only fetches articles from the last N days (default 7 days) since clustering only considers recent articles
 * - Excludes articles assigned to archived clusters (embeddings were pruned to save space and should not be regenerated)
 * - Orders by createdAt DESC to prioritize newest articles
 *
 * @param daysBack - Number of days to look back (default: 7)
 */
export async function getUnembeddedArticles(daysBack: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return prisma.article.findMany({
    where: {
      embedding: { equals: Prisma.DbNull },
      createdAt: {
        gte: cutoffDate,
      },
      clusterAssignments: {
        none: {
          cluster: {
            archived: true,
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      content: true,
      snippet: true,
      url: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}
