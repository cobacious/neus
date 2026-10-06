import { pruneArchivedClusterPayloads } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function pruneArchivedPayloads() {
  logPipelineStep(PipelineStep.Score, 'Pruning embeddings and text from archived records...');

  const { clustersPruned, articlesPruned } = await pruneArchivedClusterPayloads();

  if (clustersPruned > 0 || articlesPruned > 0) {
    logPipelineSection(
      PipelineStep.Score,
      `Pruned heavy payloads: ${clustersPruned} archived cluster(s), ${articlesPruned} archived article(s)`
    );
  } else {
    logPipelineSection(
      PipelineStep.Score,
      'No archived clusters or articles requiring payload pruning'
    );
  }
}
