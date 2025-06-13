import { prisma } from '../client';

export async function updateClusterSummary(id: string, headline: string, summary: string) {
  await prisma.cluster.update({
    where: { id },
    data: { headline, summary },
  });
}
