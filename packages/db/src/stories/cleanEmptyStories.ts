import { prisma } from '../client';

/**
 * Removes any story records that have zero clusters attached.
 * This cleans up orphan stories after clusters have been merged into another story.
 */
export async function cleanEmptyStories(): Promise<{ deletedStoriesCount: number }> {
  const emptyStories = await prisma.story.findMany({
    where: {
      clusters: {
        none: {},
      },
    },
    select: { id: true },
  });

  if (emptyStories.length === 0) {
    return { deletedStoriesCount: 0 };
  }

  const ids = emptyStories.map((s) => s.id);
  const { count } = await prisma.story.deleteMany({
    where: { id: { in: ids } },
  });

  return { deletedStoriesCount: count };
}
