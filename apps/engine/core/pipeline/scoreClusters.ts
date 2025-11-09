import { getClustersForScoring, updateClusterScore } from '@neus/db';
import { scoreCluster } from './scoreCluster';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function scoreClusters() {
  logPipelineStep(PipelineStep.Score, 'Scoring clusters...');
  const clusters = await getClustersForScoring();
  let updated = 0;
  for (const cluster of clusters) {
    const score = scoreCluster(cluster);
    await updateClusterScore(cluster.id, score);
    updated++;
  }
  logPipelineSection(PipelineStep.Score, `Scored ${updated} clusters`);
}
