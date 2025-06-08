// storeArticles.ts
// Store articles in the database, deduplicating by id (url)
import { Article } from '../../packages/types/article';
import { prisma } from './lib/prisma';

export async function storeArticles(articles: Article[]) {
  for (const article of articles) {
    try {
      // Dynamically build update/create objects to avoid undefined fields
      const updateData: any = {
        title: article.title,
        source: article.source,
        publishedAt: new Date(article.publishedAt),
      };
      const createData: any = {
        id: article.url || undefined,
        title: article.title,
        source: article.source,
        publishedAt: new Date(article.publishedAt),
      };
      if (typeof article.snippet !== 'undefined') {
        updateData.snippet = article.snippet;
        createData.snippet = article.snippet;
      }
      if (typeof article.content !== 'undefined') {
        updateData.content = article.content;
        createData.content = article.content;
      }
      await prisma.article.upsert({
        where: {
          id: article.url || undefined,
        },
        update: updateData,
        create: createData,
      });
    } catch (err) {
      console.warn(`[db] Failed to upsert article: ${article.title} (${article.url})`, err);
    }
  }
}
