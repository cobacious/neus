import { prisma } from '../client';

/**
 * Marks stories as 'dormant' if all of their clusters are older than maxInactiveDays or archived.
 *
 * @param maxInactiveDays - Number of days without active cluster updates before a story becomes dormant (default: 7)
 * @returns Number of stories marked dormant
 */
export async function markDormantStories(maxInactiveDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxInactiveDays);

  const activeStories = await prisma.story.findMany({
    where: {
      status: { in: ['breaking', 'developing'] },
    },
    select: {
      id: true,
      clusters: {
        select: {
          createdAt: true,
          archived: true,
        },
      },
    },
  });

  const dormantStoryIds: string[] = [];

  for (const story of activeStories) {
    const hasRecentActiveCluster = story.clusters.some(
      (c) => !c.archived && c.createdAt >= cutoffDate
    );
    if (!hasRecentActiveCluster) {
      dormantStoryIds.push(story.id);
    }
  }

  if (dormantStoryIds.length === 0) {
    return 0;
  }

  const result = await prisma.story.updateMany({
    where: {
      id: { in: dormantStoryIds },
    },
    data: {
      status: 'dormant',
    },
  });

  return result.count;
}
