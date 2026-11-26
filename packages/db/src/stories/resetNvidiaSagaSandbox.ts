import { prisma } from '../client';

/**
 * Resets the Nvidia / Jensen Huang saga clusters and stories exclusively in the Neon sandbox database.
 * Preserves the underlying raw articles and their embeddings while clearing previous assignments.
 */
export async function resetNvidiaSagaSandbox(): Promise<{ articleCount: number; clustersReset: number; storiesReset: number }> {
  if (!process.env.DATABASE_URL?.includes('ep-aged-hill-abxepujh')) {
    throw new Error('Refusing to run reset on non-sandbox database!');
  }

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { title: { contains: 'Jensen', mode: 'insensitive' } },
        { title: { contains: 'Huang', mode: 'insensitive' } },
        { title: { contains: 'Nvidia', mode: 'insensitive' } },
      ],
      publishedAt: {
        gte: new Date('2026-11-08T00:00:00Z'),
        lte: new Date('2026-11-25T23:59:59Z'),
      },
    },
    select: {
      id: true,
      clusterAssignments: {
        select: {
          clusterId: true,
          cluster: {
            select: {
              id: true,
              storyId: true,
            },
          },
        },
      },
    },
  });

  const articleIds = articles.map((a) => a.id);
  const clusterIds = new Set<string>();
  const storyIds = new Set<string>();

  for (const a of articles) {
    for (const ca of a.clusterAssignments) {
      clusterIds.add(ca.clusterId);
      if (ca.cluster?.storyId) {
        storyIds.add(ca.cluster.storyId);
      }
    }
  }

  // 1. Delete all cluster assignments for these clusters and articles
  if (clusterIds.size > 0) {
    await prisma.articleClusterAssignment.deleteMany({
      where: { clusterId: { in: Array.from(clusterIds) } },
    });
  }
  await prisma.articleClusterAssignment.deleteMany({
    where: { articleId: { in: articleIds } },
  });

  // 2. Delete the clusters
  let clustersReset = 0;
  if (clusterIds.size > 0) {
    const res = await prisma.cluster.deleteMany({
      where: { id: { in: Array.from(clusterIds) } },
    });
    clustersReset = res.count;
  }

  // 3. Delete the stories
  let storiesReset = 0;
  if (storyIds.size > 0) {
    const res = await prisma.story.deleteMany({
      where: { id: { in: Array.from(storyIds) } },
    });
    storiesReset = res.count;
  }

  return { articleCount: articleIds.length, clustersReset, storiesReset };
}
