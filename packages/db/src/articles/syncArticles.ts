import { prisma } from '../client';
import { UpsertArticleInput } from './upsertArticle';

export type SyncArticlesResult = {
  created: number;
  updated: number;
  unchanged: number;
};

/**
 * Compares an existing stored article with an incoming article to determine
 * if any meaningful field has been modified.
 */
export function hasArticleChanged(
  existing: {
    title: string;
    snippet: string | null;
    author: string | null;
    categories: string | null;
    updatedAt: Date | null;
    publishedAt: Date;
  },
  incoming: UpsertArticleInput
): boolean {
  // Title changed
  if (existing.title !== incoming.title) return true;

  // New non-empty snippet provided and differs from existing
  if (incoming.snippet && existing.snippet !== incoming.snippet) return true;

  // Newer updatedAt provided
  if (
    incoming.updatedAt &&
    (!existing.updatedAt || incoming.updatedAt.getTime() > existing.updatedAt.getTime())
  ) {
    return true;
  }

  // Author changed
  if (incoming.author && existing.author !== incoming.author) return true;

  // Categories changed
  if (incoming.categories && existing.categories !== incoming.categories) return true;

  return false;
}

/**
 * Stores articles in the database only if they don't already exist or have changed.
 *
 * Optimizations:
 * - Deduplicates incoming batch by URL in memory.
 * - Batch queries existing articles by URL in a single roundtrip.
 * - Skips unchanged articles entirely, preventing unnecessary PostgreSQL UPDATE queries
 *   and eliminating dead tuple / WAL bloat on repeated hourly feed polls.
 * - Inserts brand new articles in bulk using createMany.
 * - Updates only the articles whose content or metadata has actually changed.
 *
 * @param articles - Array of incoming article payloads from RSS ingestion
 * @returns Counts of created, updated, and unchanged articles
 */
export async function syncArticles(
  articles: UpsertArticleInput[]
): Promise<SyncArticlesResult> {
  // 1. Filter invalid and deduplicate by URL (keep last seen)
  const uniqueMap = new Map<string, UpsertArticleInput>();
  for (const article of articles) {
    if (!article.url || !article.title) continue;
    uniqueMap.set(article.url, article);
  }

  const uniqueArticles = Array.from(uniqueMap.values());
  if (uniqueArticles.length === 0) {
    return { created: 0, updated: 0, unchanged: 0 };
  }

  // 2. Batch query existing articles in chunks of 500
  const BATCH_SIZE = 500;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;

  for (let i = 0; i < uniqueArticles.length; i += BATCH_SIZE) {
    const chunk = uniqueArticles.slice(i, i + BATCH_SIZE);
    const urls = chunk.map((a) => a.url);

    const existingArticles = await prisma.article.findMany({
      where: { url: { in: urls } },
      select: {
        id: true,
        url: true,
        title: true,
        snippet: true,
        author: true,
        categories: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    const existingMap = new Map(existingArticles.map((e) => [e.url, e]));

    const toCreate: UpsertArticleInput[] = [];
    const toUpdate: UpsertArticleInput[] = [];

    for (const incoming of chunk) {
      const existing = existingMap.get(incoming.url);
      if (!existing) {
        toCreate.push(incoming);
      } else if (hasArticleChanged(existing, incoming)) {
        toUpdate.push(incoming);
      } else {
        totalUnchanged++;
      }
    }

    // 3. Bulk insert new articles
    if (toCreate.length > 0) {
      await prisma.article.createMany({
        data: toCreate.map((a) => ({
          url: a.url,
          title: a.title,
          source: a.source,
          sourceId: a.sourceId,
          publishedAt: a.publishedAt,
          updatedAt: a.updatedAt,
          snippet: a.snippet,
          content: a.content,
          author: a.author,
          categories: a.categories,
        })),
        skipDuplicates: true,
      });
      totalCreated += toCreate.length;
    }

    // 4. Update only changed articles
    for (const modified of toUpdate) {
      await prisma.article.update({
        where: { url: modified.url },
        data: {
          title: modified.title,
          snippet: modified.snippet,
          updatedAt: modified.updatedAt,
          author: modified.author,
          categories: modified.categories,
        },
      });
      totalUpdated++;
    }
  }

  return {
    created: totalCreated,
    updated: totalUpdated,
    unchanged: totalUnchanged,
  };
}
