import { prisma } from '../client';

export async function getClustersWithArticles() {
  return prisma.cluster.findMany({
    include: {
      articleAssignments: {
        include: { article: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
