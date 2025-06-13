import { prisma } from '../client';

export async function getArticlesMissingContent() {
  return prisma.article.findMany({
    where: {
      OR: [{ content: null }, { content: '' }],
    },
  });
}
