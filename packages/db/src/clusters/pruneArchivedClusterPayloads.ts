import { prisma } from '../client';
import { Prisma } from '@prisma/client';

export interface PruneArchivedPayloadsResult {
  clustersPruned: number;
  articlesPruned: number;
}

/**
 * Prunes heavy storage fields (vector embeddings and full article text)
 * from archived clusters and their associated articles.
 *
 * For archived clusters:
 * - Headlines and summaries have already been generated
 * - Clustering is complete and won't match against them
 * - Embeddings and full content consume ~10-15KB+ per record of JSON/text
 *
 * This strips ~80-90% of storage per record while preserving:
 * - Headlines and AI summaries
 * - Article titles, URLs, source attribution, and snippets
 * - Permalinks and SEO value
 */
export async function pruneArchivedClusterPayloads(): Promise<PruneArchivedPayloadsResult> {
  // 1. Clear embeddings on archived clusters
  const clusterResult = await prisma.cluster.updateMany({
    where: {
      archived: true,
      embedding: { not: Prisma.DbNull },
    },
    data: {
      embedding: Prisma.DbNull,
    },
  });

  // 2. Clear embeddings, rawHtml, and content on articles assigned to archived clusters
  const articleResult = await prisma.article.updateMany({
    where: {
      clusterAssignments: {
        some: {
          cluster: {
            archived: true,
          },
        },
      },
      OR: [
        { embedding: { not: Prisma.DbNull } },
        { content: { not: null } },
        { rawHtml: { not: null } },
      ],
    },
    data: {
      embedding: Prisma.DbNull,
      content: null,
      rawHtml: null,
    },
  });

  return {
    clustersPruned: clusterResult.count,
    articlesPruned: articleResult.count,
  };
}
