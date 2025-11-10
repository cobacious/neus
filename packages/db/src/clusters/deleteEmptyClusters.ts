import { prisma } from '../client';

/**
 * Deletes clusters that have no article assignments.
 *
 * Empty clusters can occur when:
 * - Articles are reassigned to different clusters
 * - Articles are deleted
 * - Clustering algorithm creates then abandons a cluster
 *
 * Returns the number of clusters deleted.
 */
export async function deleteEmptyClusters(): Promise<number> {
  // Find clusters with no article assignments
  const emptyClusters = await prisma.cluster.findMany({
    where: {
      articleAssignments: {
        none: {},
      },
    },
    select: {
      id: true,
    },
  });

  if (emptyClusters.length === 0) {
    return 0;
  }

  // Delete them
  const result = await prisma.cluster.deleteMany({
    where: {
      id: {
        in: emptyClusters.map((c) => c.id),
      },
    },
  });

  return result.count;
}
