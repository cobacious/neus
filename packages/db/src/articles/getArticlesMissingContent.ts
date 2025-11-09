import { prisma } from '../client';

/**
 * Fetches articles missing content that were created recently.
 *
 * Optimizations:
 * - Only fetches articles from the last 7 days (failed extractions don't retry forever)
 * - Limits to 50 articles per run to prevent slow accumulation
 * - Orders by createdAt DESC to prioritize newest articles
 *
 * This prevents the pipeline from retrying failed content extractions indefinitely
 * and keeps processing time stable as the database grows.
 */
export async function getArticlesMissingContent() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return prisma.article.findMany({
    where: {
      OR: [{ content: null }, { content: '' }],
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });
}
