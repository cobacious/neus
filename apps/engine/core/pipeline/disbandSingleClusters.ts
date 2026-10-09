import { disbandSingleArticleClusters } from '@neus/db';
import { logPipelineStep, logPipelineSection, PipelineStep } from '../../lib/pipelineLogger';

export async function disbandSingleClusters() {
  logPipelineStep(PipelineStep.Disband, 'Disbanding dummy single-article clusters...');

  const disbanded = await disbandSingleArticleClusters();

  if (disbanded > 0) {
    logPipelineSection(
      PipelineStep.Disband,
      `Disbanded ${disbanded} dummy cluster(s) and released unclustered articles`
    );
  } else {
    logPipelineSection(PipelineStep.Disband, 'No dummy single-article clusters found');
  }
}
