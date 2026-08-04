import { prisma } from '../client';

/**
 * Archives active clusters older than maxAgeDays.
 *
 * Soft delete (archiving) preserves:
 * - Historical URLs and SEO value
 * - Ability to show "archived" message on cluster detail pages
 * - Clean feed performance by filtering out stale clusters
 *
 * @param maxAgeDays - Maximum age in days for active clusters (default: 30)
 * @returns Number of clusters archived
 */
export async function archiveOldClusters(maxAgeDays: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const oldClusters = await prisma.cluster.findMany({
    where: {
      archived: false,
      createdAt: {
        lt: cutoffDate,
      },
      articleAssignments: {
        none: {
          article: {
            publishedAt: {
              gte: cutoffDate,
            },
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (oldClusters.length === 0) {
    return 0;
  }

  const result = await prisma.cluster.updateMany({
    where: {
      id: {
        in: oldClusters.map((c) => c.id),
      },
    },
    data: {
      archived: true,
    },
  });

  return result.count;
}
