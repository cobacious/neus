import { prisma } from '../client';

export async function deleteCluster(id: string) {
  return prisma.cluster.delete({
    where: { id },
  });
}

