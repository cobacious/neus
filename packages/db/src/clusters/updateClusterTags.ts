import { prisma } from '../client';

export async function updateClusterTags(id: string, tags: string[]) {
  return prisma.cluster.update({
    where: { id },
    data: { tags },
  });
}
