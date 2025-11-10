import { prisma } from '../client.js';

export async function getClusterBySlug(slug: string) {
  return prisma.cluster.findUnique({
    where: { slug },
    include: {
      articleAssignments: {
        include: {
          article: {
            include: { sourceRel: true },
          },
        },
      },
    },
  });
}
