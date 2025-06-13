import { prisma } from '../client';

export async function countClusters() {
  return prisma.cluster.count();
}
