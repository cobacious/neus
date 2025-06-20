import { ingestArticles } from './ingestArticles';
import { getActiveSources } from '@neus/db';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedNewArticles } from './embedArticles';
import { clusterRecentArticles } from './clusterArticles';
import { summarizeClusters } from './summarizeClusters';
import { resetPipelineLogger, logger } from '../../lib/pipelineLogger';

export async function runPipeline() {
  resetPipelineLogger();
  const sources = await getActiveSources();
  const allArticles = await ingestArticles(sources);
  await storeArticles(allArticles);
  await fillMissingContent();
  await embedNewArticles();
  await clusterRecentArticles();
  await summarizeClusters();
}
