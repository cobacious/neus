import { prisma } from '../client';

export async function getSources() {
  return prisma.source.findMany({ orderBy: { name: 'asc' } });
}
