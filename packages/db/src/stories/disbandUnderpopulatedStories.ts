import { prisma } from '../client';

/**
 * Disbands any stories that have fewer than 2 active clusters.
 * If a story has 1 cluster, that cluster is dissociated (storyId and storyAngle cleared).
 * Any story with 0 clusters is deleted.
 */
export async function disbandUnderpopulatedStories(): Promise<{
  disbandedStoriesCount: number;
  dissociatedClustersCount: number;
}> {
  const stories = await prisma.story.findMany({
    include: {
      clusters: {
        where: { archived: false },
        select: { id: true },
      },
    },
  });

  let disbandedStoriesCount = 0;
  let dissociatedClustersCount = 0;

  for (const story of stories) {
    if (story.clusters.length < 2) {
      if (story.clusters.length === 1) {
        await prisma.cluster.update({
          where: { id: story.clusters[0].id },
          data: {
            storyId: null,
            storyAngle: null,
          },
        });
        dissociatedClustersCount++;
      }

      await prisma.story.delete({
        where: { id: story.id },
      });
      disbandedStoriesCount++;
    }
  }

  return { disbandedStoriesCount, dissociatedClustersCount };
}
