import { prisma } from '../client';

/**
 * Dissociates the given clusters from any story (clears storyId and storyAngle).
 */
export async function dissociateClusters(clusterIds: string[]): Promise<{ count: number }> {
  if (!clusterIds || clusterIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.cluster.updateMany({
    where: { id: { in: clusterIds } },
    data: {
      storyId: null,
      storyAngle: null,
    },
  });

  return { count: result.count };
}
