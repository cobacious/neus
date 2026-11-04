import { getClustersForScoring, updateClusterScoresBatch } from '@neus/db';
import { scoreCluster, ScorableCluster } from './scoreCluster';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function scoreClusters() {
  logPipelineStep(PipelineStep.Score, 'Scoring clusters in batch...');
  const clusters = await getClustersForScoring();

  const storyClustersMap = new Map<string, ScorableCluster[]>();
  for (const cluster of clusters) {
    if (cluster.storyId) {
      let group = storyClustersMap.get(cluster.storyId);
      if (!group) {
        group = [];
        storyClustersMap.set(cluster.storyId, group);
      }
      group.push(cluster as ScorableCluster);
    }
  }

  const now = Date.now();
  const updates = clusters.map((cluster) => ({
    id: cluster.id,
    score: scoreCluster(
      cluster as ScorableCluster,
      now,
      cluster.storyId ? storyClustersMap.get(cluster.storyId) : undefined
    ),
  }));
  const updated = await updateClusterScoresBatch(updates);
  logPipelineSection(PipelineStep.Score, `Scored ${updated} clusters in batch`);
}
