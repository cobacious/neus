import { prisma } from '../client';

export async function updateArticleContent(
  id: string,
  content: string,
  updatedAt?: Date
) {
  await prisma.article.update({
    where: { id },
    data: { content, updatedAt },
  });
}
