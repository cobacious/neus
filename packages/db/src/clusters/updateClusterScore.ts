import { prisma } from '../client';

export async function updateClusterScore(id: string, score: number) {
  await prisma.cluster.update({
    where: { id },
    data: { score },
  });
}
