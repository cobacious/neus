import { prisma } from '../client';

export async function getClustersWithArticles() {
  return prisma.cluster.findMany({
    include: {
      articleAssignments: {
        include: { article: true },
      },
    },
    orderBy: [
      {
        articleAssignments: {
          _count: 'desc',
        },
      },
      { createdAt: 'desc' },
    ],
  });
}
