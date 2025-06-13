import { prisma } from '../client';

export async function updateArticleEmbedding(id: string, embedding: number[]) {
  await prisma.article.update({
    where: { id },
    data: { embedding },
  });
}
