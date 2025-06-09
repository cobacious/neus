// Main processing pipeline for ingested articles
// This is where clustering, summarisation, and storage will be handled
import '../../env'; // Loads .env and proxy support
import { ingestArticles } from './ingestArticles';
import { FEED_URLS } from '../../feeds.config';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedNewArticles } from './embedArticles';
import { clusterRecentArticles } from './clusterArticles';
import { summarizeClusters } from './summarizeClusters';
import { resetPipelineLogger, logger } from '../../lib/pipelineLogger';

export async function runPipeline() {
  resetPipelineLogger();
  const allArticles = await ingestArticles(FEED_URLS);
  await storeArticles(allArticles);
  await fillMissingContent();
  await embedNewArticles();
  await clusterRecentArticles();
  await summarizeClusters();
}
