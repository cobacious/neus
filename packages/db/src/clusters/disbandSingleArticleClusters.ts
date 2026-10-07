import { prisma } from '../client';

/**
 * Disbands dummy clusters that have <= 1 article assignment and no headline/summary.
 *
 * Isolated articles without matching stories should not occupy dummy clusters.
 * Disbanding these dummy clusters:
 * 1. Deletes the cluster assignments so the articles become unclustered.
 * 2. Unclustered articles older than 7 days can then be purged by deleteOldUnclusteredArticles.
 * 3. Deletes dummy cluster records and their 1,536-dimensional embedding vectors.
 *
 * @returns Number of dummy clusters deleted
 */
export async function disbandSingleArticleClusters(): Promise<number> {
  const dummyClusters = await prisma.cluster.findMany({
    where: {
      OR: [
        { headline: null },
        { headline: '' },
      ],
    },
    select: {
      id: true,
      _count: {
        select: { articleAssignments: true },
      },
    },
  });

  const dummyClusterIds = dummyClusters
    .filter((c) => c._count.articleAssignments <= 1)
    .map((c) => c.id);

  if (dummyClusterIds.length === 0) {
    return 0;
  }

  const BATCH_SIZE = 1000;
  let totalDeleted = 0;

  for (let i = 0; i < dummyClusterIds.length; i += BATCH_SIZE) {
    const batch = dummyClusterIds.slice(i, i + BATCH_SIZE);

    // Delete assignments first to satisfy foreign key constraints
    await prisma.articleClusterAssignment.deleteMany({
      where: {
        clusterId: { in: batch },
      },
    });

    // Delete the dummy clusters
    const deleteResult = await prisma.cluster.deleteMany({
      where: {
        id: { in: batch },
      },
    });

    totalDeleted += deleteResult.count;
  }

  return totalDeleted;
}
