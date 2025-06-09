// Main processing pipeline for ingested articles
// This is where clustering, summarization, and storage will be handled
import '../env'; // Loads .env and proxy support
import { ingestArticles } from './ingestArticles';
import { FEED_URLS } from '../feeds.config';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedAndClusterNewArticles } from './embedAndGroup';
import { summarizeClusters } from './summarizeClusters';
import { resetPipelineLogger } from '../pipelineLogger';

export async function runPipeline() {
  resetPipelineLogger();
  const allArticles = await ingestArticles(FEED_URLS);
  await storeArticles(allArticles);
  await fillMissingContent();
  await embedAndClusterNewArticles();
  await summarizeClusters();
  console.log('\n' + '='.repeat(80));
  console.log('[pipeline] Pipeline complete!');
}
