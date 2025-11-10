import { prisma } from '../client';

export async function countClusters() {
  return prisma.cluster.count({
    where: {
      AND: [
        { headline: { not: null } },
        { headline: { not: '' } },
        { summary: { not: null } },
        { summary: { not: '' } },
      ],
    },
  });
}
