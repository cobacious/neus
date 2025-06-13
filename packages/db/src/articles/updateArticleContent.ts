import { prisma } from '../client';

export async function updateArticleContent(id: string, content: string) {
  await prisma.article.update({
    where: { id },
    data: { content },
  });
}
