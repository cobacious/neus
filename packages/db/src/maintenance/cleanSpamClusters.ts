import { prisma } from '../client';

export interface CleanSpamClustersResult {
  archivedStandaloneSingleSource: number;
  archivedDeactivatedSourceClusters: number;
  totalArchived: number;
}

/**
 * Retrospectively archives single-source standalone clusters and clusters composed
 * solely of deactivated sources (such as Daily Express or The Sun).
 * Preserves unclustered articles so future corroborating sources can re-cluster them.
 */
export async function cleanSpamClusters(): Promise<CleanSpamClustersResult> {
  const allActiveClusters = await prisma.cluster.findMany({
    where: { archived: false },
    select: {
      id: true,
      storyId: true,
      articleAssignments: {
        select: {
          article: {
            select: {
              sourceRel: {
                select: { name: true, active: true },
              },
            },
          },
        },
      },
    },
  });

  const clusterIdsToArchive: string[] = [];
  let archivedStandaloneSingleSource = 0;
  let archivedDeactivatedSourceClusters = 0;

  for (const c of allActiveClusters) {
    const sources = new Set(
      c.articleAssignments.map((a) => a.article.sourceRel?.name).filter(Boolean)
    );
    const allInactive =
      c.articleAssignments.length > 0 &&
      c.articleAssignments.every((a) => a.article.sourceRel?.active === false);

    if (allInactive && sources.size > 0) {
      clusterIdsToArchive.push(c.id);
      archivedDeactivatedSourceClusters++;
    } else if (sources.size < 2 && !c.storyId) {
      clusterIdsToArchive.push(c.id);
      archivedStandaloneSingleSource++;
    }
  }

  if (clusterIdsToArchive.length > 0) {
    await prisma.cluster.updateMany({
      where: { id: { in: clusterIdsToArchive } },
      data: { archived: true },
    });
  }

  return {
    archivedStandaloneSingleSource,
    archivedDeactivatedSourceClusters,
    totalArchived: clusterIdsToArchive.length,
  };
}
