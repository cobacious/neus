import { prisma } from '../client';

export async function getClusterById(id: string) {
  return prisma.cluster.findUnique({
    where: { id },
    include: {
      story: {
        include: {
          clusters: {
            where: { archived: false },
            orderBy: { createdAt: 'asc' },
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
          },
        },
      },
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
  });
}
