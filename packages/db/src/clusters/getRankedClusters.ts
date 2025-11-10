import { Prisma } from '@prisma/client';
import { prisma } from '../client';

export async function getRankedClusters(limit?: number, offset?: number) {
  const query: Prisma.ClusterFindManyArgs = {
    where: {
      AND: [
        { headline: { not: null } },
        { headline: { not: '' } },
        { summary: { not: null } },
        { summary: { not: '' } },
        { archived: false },
      ],
    },
    include: {
      articleAssignments: {
        select: {
          createdAt: true,
          article: {
            select: {
              id: true,
              url: true,
              title: true,
              source: true,
              publishedAt: true,
              author: true,
              sourceRel: {
                select: {
                  id: true,
                  name: true,
                  faviconUrl: true,
                },
              },
            },
          },
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
