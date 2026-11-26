import { prisma } from '../client';

/**
 * Fetches Nvidia / Jensen Huang articles for a specific historical date range
 * formatted for the clustering pipeline.
 */
export async function getNvidiaArticlesByDateRange(startDate: string, endDate: string) {
  return prisma.article.findMany({
    where: {
      OR: [
        { title: { contains: 'Jensen', mode: 'insensitive' } },
        { title: { contains: 'Huang', mode: 'insensitive' } },
        { title: { contains: 'Nvidia', mode: 'insensitive' } },
      ],
      publishedAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    select: {
      id: true,
      title: true,
      embedding: true,
      createdAt: true,
      publishedAt: true,
      sourceId: true,
      source: true,
    },
    orderBy: { publishedAt: 'asc' },
  });
}
