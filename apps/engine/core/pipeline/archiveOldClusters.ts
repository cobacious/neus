import { archiveOldClusters as dbArchiveOldClusters } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function archiveOldClusters() {
  logPipelineStep(PipelineStep.Score, 'Archiving stale clusters...');

  const maxAgeDays = process.env.CLUSTER_MAX_AGE_DAYS
    ? parseInt(process.env.CLUSTER_MAX_AGE_DAYS, 10)
    : 30;

  const archived = await dbArchiveOldClusters(maxAgeDays);

  if (archived > 0) {
    logPipelineSection(
      PipelineStep.Score,
      `Archived ${archived} cluster(s) older than ${maxAgeDays} days`
    );
  } else {
    logPipelineSection(PipelineStep.Score, `No clusters older than ${maxAgeDays} days to archive`);
  }
}
