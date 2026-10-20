import { prisma } from '../client';

/**
 * Returns the createdAt timestamp of the most recently created cluster,
 * which serves as the local database indicator of when the full pipeline last executed.
 */
export async function getLatestPipelineRunTime(): Promise<Date | null> {
  const latestCluster = await prisma.cluster.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return latestCluster?.createdAt ?? null;
}
