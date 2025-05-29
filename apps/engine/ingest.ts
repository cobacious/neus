// Entry point for running article ingestion from the command line
// Usage: pnpm tsx apps/engine/ingest.ts <rss-url>

import { fetchArticlesFromRss } from './articleIngestion';
import { processAndStoreArticles } from './pipeline';

// If using TypeScript with "type": "module", explicitly import node types for process
declare const process: any;

// @ts-ignore
async function main() {
  const feedUrl = process.argv[2];
  if (!feedUrl) {
    console.error('Usage: pnpm tsx apps/engine/ingest.ts <rss-url>');
    process.exit(1);
  }
  const articles = await fetchArticlesFromRss(feedUrl);
  await processAndStoreArticles(articles);
}

main();
