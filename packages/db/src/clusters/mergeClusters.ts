import { prisma } from '../client';

/**
 * Merges one or more redundant source clusters into a target cluster.
 *
 * 1. Reassigns non-duplicate articles from source clusters to the target cluster.
 * 2. Deletes redundant duplicate assignments in source clusters.
 * 3. Permanently deletes the source clusters.
 *
 * @param targetClusterId - The cluster that will retain the articles
 * @param sourceClusterIds - The duplicate clusters being merged into the target
 * @returns Number of article assignments moved to the target cluster
 */
export async function mergeClusters(
  targetClusterId: string,
  sourceClusterIds: string[]
): Promise<number> {
  const sources = sourceClusterIds.filter((id) => id !== targetClusterId);
  if (sources.length === 0) {
    return 0;
  }

  // 1. Get all articles currently assigned to the target cluster
  const targetAssignments = await prisma.articleClusterAssignment.findMany({
    where: { clusterId: targetClusterId },
    select: { articleId: true },
  });
  const existingArticleIds = targetAssignments.map((a) => a.articleId);

  // 2. Reassign non-overlapping articles from source clusters to target
  const updateResult = await prisma.articleClusterAssignment.updateMany({
    where: {
      clusterId: { in: sources },
      articleId: { notIn: existingArticleIds },
    },
    data: {
      clusterId: targetClusterId,
    },
  });

  // 3. Delete any leftover overlapping assignments in sources
  await prisma.articleClusterAssignment.deleteMany({
    where: {
      clusterId: { in: sources },
    },
  });

  // 4. Delete the source clusters
  await prisma.cluster.deleteMany({
    where: {
      id: { in: sources },
    },
  });

  return updateResult.count;
}
