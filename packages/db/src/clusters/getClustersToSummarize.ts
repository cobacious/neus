import { prisma } from '../client';

export async function getClustersToSummarize() {
  const clusters = await prisma.cluster.findMany({
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

  return clusters.filter((cluster) => cluster.articleAssignments.length > 1);
}
