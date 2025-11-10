import { prisma } from '../client';

export async function getRankedClusters(limit?: number, offset?: number) {
  const query: any = {
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
  };

  if (limit !== undefined && limit !== null) {
    query.take = limit;
  }

  if (offset !== undefined && offset !== null) {
    query.skip = offset;
  }

  return prisma.cluster.findMany(query);
}
