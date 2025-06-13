import { prisma } from '../client';

export async function getClustersToSummarize() {
  return prisma.cluster.findMany({
    where: {
      OR: [
        { headline: { equals: null } },
        { summary: { equals: null } },
        { headline: { equals: '' } },
        { summary: { equals: '' } },
      ],
    },
    include: {
      articleAssignments: {
        include: { article: true },
      },
    },
  });
}
