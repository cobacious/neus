import { prisma } from '../client';

/**
 * Returns the maximum timestamp across:
 * 1. Latest Cluster.createdAt
 * 2. Latest Article.createdAt
 * 3. Latest active Source.lastFetchedAt
 * which serves as the local database indicator of when the background pipeline last executed.
 */
export async function getLatestPipelineRunTime(): Promise<Date | null> {
  const [latestCluster, latestArticle, latestSource] = await Promise.all([
    prisma.cluster.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.article.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.source.findFirst({
      where: { active: true, lastFetchedAt: { not: null } },
      orderBy: { lastFetchedAt: 'desc' },
      select: { lastFetchedAt: true },
    }),
  ]);

  const candidates = [
    latestCluster?.createdAt,
    latestArticle?.createdAt,
    latestSource?.lastFetchedAt,
  ].filter((d): d is Date => d != null);

  const validDates = candidates
    .map((d) => (d instanceof Date ? d : new Date(d)))
    .filter((d) => !isNaN(d.getTime()));

  if (validDates.length === 0) {
    return null;
  }

  const maxTime = Math.max(...validDates.map((d) => d.getTime()));
  return new Date(maxTime);
}
