import { prisma } from '../client';

export async function getRecentEmbeddedArticles(since: Date) {
  return prisma.article.findMany({
    where: {
      embedding: { not: { equals: null } },
      publishedAt: { gte: since },
    },
  });
}
