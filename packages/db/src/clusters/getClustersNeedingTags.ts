import { prisma } from '../client';

/**
 * Fetches active, summarized clusters that do not yet have tags assigned.
 *
 * @param limit - Maximum number of clusters to fetch (default: 100)
 */
export async function getClustersNeedingTags(limit: number = 100) {
  return prisma.cluster.findMany({
    where: {
      archived: false,
      headline: { not: null },
      summary: { not: null },
      tags: { isEmpty: true },
    },
    select: {
      id: true,
      headline: true,
      summary: true,
      tags: true,
      storyId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
