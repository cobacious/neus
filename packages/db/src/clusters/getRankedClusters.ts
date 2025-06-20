import { prisma } from '../client';
import { scoreCluster, ScorableCluster } from './scoreCluster';

export async function getRankedClusters() {
  const clusters = await prisma.cluster.findMany({
    include: {
      articleAssignments: {
        include: {
          article: { include: { sourceRel: true } },
        },
      },
    },
  });

  const scored = clusters.map((c) => ({ ...c, score: scoreCluster(c as ScorableCluster) }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
