import { prisma } from '../client';

/**
 * Fetches active stories that do not yet have tags assigned,
 * along with their member clusters' tags.
 *
 * @param limit - Maximum number of stories to fetch (default: 50)
 */
export async function getStoriesNeedingTags(limit: number = 50) {
  return prisma.story.findMany({
    where: {
      tags: { isEmpty: true },
    },
    select: {
      id: true,
      title: true,
      tags: true,
      clusters: {
        select: {
          id: true,
          tags: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}
