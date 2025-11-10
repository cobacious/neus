import { prisma } from '../client';

export async function getRankedClusters(limit?: number, offset?: number) {
  return prisma.cluster.findMany({
    where: {
      AND: [
        { headline: { not: null } },
        { headline: { not: '' } },
        { summary: { not: null } },
        { summary: { not: '' } },
      ],
    },
    include: {
      articleAssignments: {
        include: {
          article: { include: { sourceRel: true } },
        },
      },
    },
    orderBy: { score: 'desc' },
    ...(limit !== undefined && { take: limit }),
    ...(offset !== undefined && { skip: offset }),
  });
}
