import { disbandSingleArticleClusters } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function disbandSingleClusters() {
  logPipelineStep(PipelineStep.Cluster, 'Disbanding dummy single-article clusters...');

  const disbanded = await disbandSingleArticleClusters();

  if (disbanded > 0) {
    logPipelineSection(
      PipelineStep.Cluster,
      `Disbanded ${disbanded} dummy cluster(s) and released unclustered articles`
    );
  } else {
    logPipelineSection(PipelineStep.Cluster, 'No dummy single-article clusters found');
  }
}
