import { prisma } from '../client.js';

export async function getClusterBySlug(slug: string) {
  return prisma.cluster.findUnique({
    where: { slug },
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
  });
}
