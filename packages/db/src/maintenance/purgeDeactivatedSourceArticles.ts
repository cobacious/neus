import { prisma } from '../client';
import { cleanSpamClusters } from './cleanSpamClusters';
import { deleteEmptyClusters } from '../clusters/deleteEmptyClusters';

export interface PurgeDeactivatedResult {
  purgedArticleAssignments: number;
  purgedArticles: number;
  sourcesAffected: string[];
}

/**
 * Permanently purges all articles and article-cluster assignments belonging
 * to deactivated editorial sources (specifically low-quality tabloid spam like
 * Daily Express and The Sun).
 * Then soft-deletes (archives) any clusters that are left empty or below 2 active sources.
 */
export async function purgeDeactivatedSourceArticles(): Promise<PurgeDeactivatedResult> {
  const inactiveSources = await prisma.source.findMany({
    where: { active: false, name: { in: ['Daily Express', 'The Sun'] } },
    select: { id: true, name: true },
  });

  if (inactiveSources.length === 0) {
    return { purgedArticleAssignments: 0, purgedArticles: 0, sourcesAffected: [] };
  }

  const inactiveSourceIds = inactiveSources.map((s) => s.id);

  // 1. Delete all ArticleClusterAssignment records for articles belonging to inactive sources
  const deletedAssignments = await prisma.articleClusterAssignment.deleteMany({
    where: {
      article: {
        sourceId: { in: inactiveSourceIds },
      },
    },
  });

  // 2. Delete the Article records themselves
  const deletedArticles = await prisma.article.deleteMany({
    where: {
      sourceId: { in: inactiveSourceIds },
    },
  });

  // 3. Archive any empty clusters
  await deleteEmptyClusters();

  // 4. Archive any clusters left with < 2 active sources and clean up underpopulated stories
  await cleanSpamClusters();

  return {
    purgedArticleAssignments: deletedAssignments.count,
    purgedArticles: deletedArticles.count,
    sourcesAffected: inactiveSources.map((s) => s.name),
  };
}
