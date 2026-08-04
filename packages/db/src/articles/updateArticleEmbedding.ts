import { prisma } from '../client';
import { Prisma } from '@prisma/client';

export async function updateArticleEmbedding(id: string, embedding: number[]) {
  await prisma.article.update({
    where: { id },
    data: { embedding },
  });
}

export async function clearArticleEmbedding(id: string) {
  await prisma.article.update({
    where: { id },
    data: { embedding: Prisma.DbNull },
  });
}
