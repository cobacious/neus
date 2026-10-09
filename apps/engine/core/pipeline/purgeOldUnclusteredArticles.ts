import { deleteOldUnclusteredArticles } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function purgeOldUnclusteredArticles() {
  logPipelineStep(PipelineStep.Purge, 'Purging stale unclustered articles...');

  const maxAgeDays = process.env.UNCLUSTERED_ARTICLE_MAX_AGE_DAYS
    ? parseInt(process.env.UNCLUSTERED_ARTICLE_MAX_AGE_DAYS, 10)
    : 7;

  const deleted = await deleteOldUnclusteredArticles(maxAgeDays);

  if (deleted > 0) {
    logPipelineSection(
      PipelineStep.Purge,
      `Purged ${deleted} unclustered article(s) older than ${maxAgeDays} days`
    );
  } else {
    logPipelineSection(
      PipelineStep.Purge,
      `No unclustered articles older than ${maxAgeDays} days to purge`
    );
  }
}
