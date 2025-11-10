import { prisma } from '../client';

/**
 * Archives clusters that have no article assignments instead of deleting them.
 *
 * Empty clusters can occur when:
 * - Articles are reassigned to different clusters
 * - Articles are deleted
 * - Clustering algorithm creates then abandons a cluster
 *
 * Soft delete (archiving) preserves:
 * - Historical URLs and SEO value
 * - Ability to show "archived" message instead of 404
 * - Data for analytics and debugging
 *
 * Returns the number of clusters archived.
 */
export async function deleteEmptyClusters(): Promise<number> {
  // Find clusters with no article assignments that aren't already archived
  const emptyClusters = await prisma.cluster.findMany({
    where: {
      articleAssignments: {
        none: {},
      },
      archived: false,
    },
    select: {
      id: true,
    },
  });

  if (emptyClusters.length === 0) {
    return 0;
  }

  // Archive them (soft delete)
  const result = await prisma.cluster.updateMany({
    where: {
      id: {
        in: emptyClusters.map((c) => c.id),
      },
    },
    data: {
      archived: true,
    },
  });

  return result.count;
}
