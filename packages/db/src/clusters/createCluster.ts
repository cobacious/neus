import { prisma } from '../client';

export async function createCluster(origin: string, label: string | null) {
  return prisma.cluster.create({
    data: { origin, label },
  });
}
