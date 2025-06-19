import { prisma } from '../client';

export async function getClusterById(id: string) {
  return prisma.cluster.findUnique({
    where: { id },
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
