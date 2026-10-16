import { prisma } from '../client';
import { disbandUnderpopulatedStories } from '../stories/disbandUnderpopulatedStories';

export interface CleanSpamClustersResult {
  archivedStandaloneSingleSource: number;
  archivedStorySingleSource: number;
  archivedDeactivatedSourceClusters: number;
  disbandedStoriesCount: number;
  totalArchived: number;
}

/**
 * Retrospectively archives clusters that have fewer than 2 active sources
 * (including single-source and deactivated-source story angles like Daily Express spam).
 * Then disbands any stories left with fewer than 2 active angles.
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
  let archivedStorySingleSource = 0;
  let archivedDeactivatedSourceClusters = 0;

  for (const c of allActiveClusters) {
    const activeSources = new Set(
      c.articleAssignments
        .filter((a) => a.article.sourceRel?.active === true)
        .map((a) => a.article.sourceRel?.name)
        .filter(Boolean)
    );

    const allInactive =
      c.articleAssignments.length > 0 &&
      c.articleAssignments.every((a) => a.article.sourceRel?.active === false);

    if (allInactive && c.articleAssignments.length > 0) {
      clusterIdsToArchive.push(c.id);
      archivedDeactivatedSourceClusters++;
    } else if (activeSources.size < 2) {
      clusterIdsToArchive.push(c.id);
      if (c.storyId) {
        archivedStorySingleSource++;
      } else {
        archivedStandaloneSingleSource++;
      }
    }
  }

  if (clusterIdsToArchive.length > 0) {
    await prisma.cluster.updateMany({
      where: { id: { in: clusterIdsToArchive } },
      data: { archived: true },
    });
  }

  const { disbandedStoriesCount } = await disbandUnderpopulatedStories();

  return {
    archivedStandaloneSingleSource,
    archivedStorySingleSource,
    archivedDeactivatedSourceClusters,
    disbandedStoriesCount,
    totalArchived: clusterIdsToArchive.length,
  };
}
