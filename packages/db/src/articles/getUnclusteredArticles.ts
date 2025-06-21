import { prisma } from '../client';

export async function getUnclusteredArticles() {
  return prisma.article.findMany({
    where: {
      embedding: { not: { equals: null } },
      clusterAssignments: { none: {} },
    },
  });
}
