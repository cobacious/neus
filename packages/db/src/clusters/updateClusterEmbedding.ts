import { prisma } from '../client';

export async function updateClusterEmbedding(id: string, embedding: number[]) {
  await prisma.cluster.update({
    where: { id },
    data: { embedding },
  });
}
