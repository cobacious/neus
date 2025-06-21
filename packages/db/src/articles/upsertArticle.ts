import { prisma } from '../client';

export type UpsertArticleInput = {
  url: string;
  title: string;
  source: string;
  sourceId: string;
  publishedAt: Date;
  updatedAt?: Date;
  snippet?: string;
  content?: string;
  author?: string;
  categories?: string;
};

export async function upsertArticle(data: UpsertArticleInput) {
  const { url, ...rest } = data;
  await prisma.article.upsert({
    where: { url },
    update: rest,
    create: { url, ...rest },
  });
}
