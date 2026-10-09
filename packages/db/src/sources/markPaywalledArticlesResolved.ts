import { prisma } from '../client';
import { isPaywalledSource } from './paywalledSources';

/**
 * Bulk updates any existing articles in the database that have missing content (content: null)
 * and belong to paywalled sources, setting their content to empty string ''.
 *
 * This prevents the pipeline from retrying URL fetches on paywalled articles.
 *
 * @returns Number of articles marked resolved
 */
export async function markPaywalledArticlesResolved(): Promise<number> {
  const sources = await prisma.source.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
      homepageUrl: true,
      paywalled: true,
    },
  });

  const paywalledSourceIds = sources
    .filter((s) => isPaywalledSource(s))
    .map((s) => s.id);

  if (paywalledSourceIds.length === 0) {
    return 0;
  }

  const result = await prisma.article.updateMany({
    where: {
      content: null,
      sourceId: {
        in: paywalledSourceIds,
      },
    },
    data: {
      content: '',
    },
  });

  return result.count;
}
