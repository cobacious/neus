import { prisma } from '../client';
import { getLatestPipelineRunTime } from '../clusters/getLatestPipelineRunTime';

export interface PipelineStatusData {
  lastRunAt: number;
  lastRunIso: string;
  activeClusters: number;
  totalArticles: number;
}

/**
 * Retrieves aggregate background pipeline status including execution timestamp
 * active cluster count and total article count.
 */
export async function getPipelineStatus(): Promise<PipelineStatusData> {
  const [latestRunTime, activeClusters, totalArticles] = await Promise.all([
    getLatestPipelineRunTime(),
    prisma.cluster.count({
      where: {
        archived: false,
      },
    }),
    prisma.article.count(),
  ]);

  const effectiveDate = latestRunTime ?? new Date();

  return {
    lastRunAt: effectiveDate.getTime(),
    lastRunIso: effectiveDate.toISOString(),
    activeClusters,
    totalArticles,
  };
}
