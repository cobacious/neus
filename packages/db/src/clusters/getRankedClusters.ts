import { prisma } from '../client';

export async function getRankedClusters() {
  return prisma.cluster.findMany({
    include: {
      articleAssignments: {
        include: {
          article: { include: { sourceRel: true } },
        },
      },
    },
    orderBy: { score: 'desc' },
  });
}
