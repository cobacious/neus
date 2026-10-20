import { prisma } from '../client';

export interface RecentPulseArticle {
  id: string;
  title: string;
  sourceId: string;
  publishedAt: Date;
  embedding?: number[] | null;
}

/**
 * Fetches recent articles for Pulse editorial velocity and surge detection.
 * Defaults to the last 2 hours.
 */
export async function getRecentArticlesForPulse(hoursBack = 2): Promise<RecentPulseArticle[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const rows = await prisma.article.findMany({
    where: {
      publishedAt: { gte: cutoff },
    },
    select: {
      id: true,
      title: true,
      sourceId: true,
      publishedAt: true,
      embedding: true,
    },
    orderBy: { publishedAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    sourceId: r.sourceId,
    publishedAt: r.publishedAt,
    embedding: (Array.isArray(r.embedding) ? r.embedding : null) as number[] | null,
  }));
}
