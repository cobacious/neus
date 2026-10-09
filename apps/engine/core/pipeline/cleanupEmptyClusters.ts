import { deleteEmptyClusters } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function cleanupEmptyClusters() {
  logPipelineStep(PipelineStep.Cleanup, 'Cleaning up empty clusters...');

  const deleted = await deleteEmptyClusters();

  if (deleted > 0) {
    logPipelineSection(PipelineStep.Cleanup, `Deleted ${deleted} empty cluster(s)`);
  } else {
    logPipelineSection(PipelineStep.Cleanup, 'No empty clusters found');
  }
}
