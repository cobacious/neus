import { prisma } from '../client';
import { Prisma } from '@prisma/client';

export async function getUnembeddedArticles() {
  return prisma.article.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
    select: {
      id: true,
      title: true,
      content: true,
      snippet: true,
      url: true,
    },
  });
}
