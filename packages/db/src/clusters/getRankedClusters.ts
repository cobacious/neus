import { prisma } from '../client';

export async function getRankedClusters() {
  const clusters = await prisma.cluster.findMany({
    include: {
      articleAssignments: {
        include: {
          article: { include: { sourceRel: true } },
        },
      },
    },
    orderBy: { score: 'desc' },
  });
  return clusters.filter((cluster) => cluster.articleAssignments.length > 1);
}
