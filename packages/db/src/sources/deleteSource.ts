import { prisma } from '../client';

export async function deleteSource(id: string) {
  await prisma.source.delete({ where: { id } });
}
