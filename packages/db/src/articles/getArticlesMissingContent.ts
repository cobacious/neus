import { prisma } from '../client';

/**
 * Fetches articles missing content that were created recently.
 *
 * Optimizations:
 * - Only fetches articles from the last 7 days (failed extractions don't retry forever)
 * - Limits articles per run if MAX_CONTENT_EXTRACTION is set (set to 0 for unlimited)
 * - Orders by createdAt DESC to prioritize newest articles
 *
 * This prevents the pipeline from retrying failed content extractions indefinitely
 * and keeps processing time stable as the database grows.
 */
export async function getArticlesMissingContent(limit?: number) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const maxArticles =
    limit ??
    (process.env.MAX_CONTENT_EXTRACTION
      ? parseInt(process.env.MAX_CONTENT_EXTRACTION, 10)
      : 30); // Default to 30 to bound execution time; 0 = unlimited

  const query: any = {
    where: {
      content: null,
      sourceRel: {
        paywalled: false,
      },
      createdAt: {
        gte: sevenDaysAgo,
      },
      clusterAssignments: {
        none: {
          cluster: {
            archived: true,
          },
        },
      },
    },
    include: {
      sourceRel: {
        select: {
          id: true,
          name: true,
          domain: true,
          paywalled: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  };

  // Only add limit if configured (> 0)
  if (maxArticles > 0) {
    query.take = maxArticles;
  }

  return prisma.article.findMany(query);
}
