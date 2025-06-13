import { prisma } from '../client';
import type { Prisma } from '@prisma/client';

export async function getUnembeddedArticles() {
  return prisma.article.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
  });
}
