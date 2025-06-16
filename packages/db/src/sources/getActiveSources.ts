import { prisma } from '../client';

export async function getActiveSources() {
  return prisma.source.findMany({ where: { active: true } });
}
