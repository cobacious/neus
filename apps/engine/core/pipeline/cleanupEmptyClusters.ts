import { deleteEmptyClusters } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function cleanupEmptyClusters() {
  logPipelineStep(PipelineStep.Score, 'Cleaning up empty clusters...');

  const deleted = await deleteEmptyClusters();

  if (deleted > 0) {
    logPipelineSection(PipelineStep.Score, `Deleted ${deleted} empty cluster(s)`);
  } else {
    logPipelineSection(PipelineStep.Score, 'No empty clusters found');
  }
}
