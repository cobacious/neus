import { getClustersForScoring, updateClusterScoresBatch } from '@neus/db';
import { scoreCluster } from './scoreCluster';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function scoreClusters() {
  logPipelineStep(PipelineStep.Score, 'Scoring clusters in batch...');
  const clusters = await getClustersForScoring();
  const updates = clusters.map((cluster) => ({
    id: cluster.id,
    score: scoreCluster(cluster),
  }));
  const updated = await updateClusterScoresBatch(updates);
  logPipelineSection(PipelineStep.Score, `Scored ${updated} clusters in batch`);
}
