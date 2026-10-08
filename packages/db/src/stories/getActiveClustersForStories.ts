import { prisma } from '../client';

/**
 * Fetches active, summarized clusters from the past N days to evaluate for multi-angle story grouping.
 *
 * @param daysBack - Number of days to look back (default: 7)
 */
export async function getActiveClustersForStories(daysBack: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return prisma.cluster.findMany({
    where: {
      archived: false,
      headline: { not: null },
      summary: { not: null },
      createdAt: { gte: cutoffDate },
    },
    select: {
      id: true,
      headline: true,
      summary: true,
      createdAt: true,
      storyId: true,
      storyAngle: true,
      embedding: true,
      _count: {
        select: { articleAssignments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
