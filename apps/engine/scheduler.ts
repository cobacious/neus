// Scheduler for periodic article ingestion
// Runs every 4 hours using setInterval (for dev/local); use a real scheduler in production

import './env'; // Loads .env and proxy support
import { FEED_URLS } from './feeds.config';
import { fetchArticlesFromRss } from './articleIngestion';
import { processAndStoreArticles } from './pipeline';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

async function ingestAllFeeds() {
  let allArticles: import('../../packages/types/article').Article[] = [];
  for (const url of FEED_URLS) {
    try {
      const articles = await fetchArticlesFromRss(url);
      allArticles = allArticles.concat(articles);
      console.log(`[${new Date().toISOString()}] Ingested ${articles.length} articles from ${url}`);
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' || err?.status === 403) {
        console.warn(`[${new Date().toISOString()}] Skipping feed (error ${err.status || err.code}): ${url}`);
      } else {
        console.error(`[${new Date().toISOString()}] Error ingesting ${url}:`, err);
      }
    }
  }
  if (allArticles.length > 0) {
    await processAndStoreArticles(allArticles);
  } else {
    console.warn('No articles ingested from any feed.');
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[fatal] Unhandled Rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught Exception:', err);
  process.exit(1);
});

// Run immediately, then every 4 hours
(async () => {
  try {
    await ingestAllFeeds();
    console.log('[debug] Initial ingestAllFeeds() completed. Scheduler will now run every 4 hours.');
  } catch (err) {
    console.error('[fatal] Error in initial ingestAllFeeds:', err);
    process.exit(1);
  }
})();
setInterval(ingestAllFeeds, FOUR_HOURS_MS);

process.on('exit', (code) => {
  console.log(`[debug] Process exiting with code ${code}`);
});

// TODO: Replace setInterval with a production scheduler (e.g. cron, serverless cron, or cloud scheduler)
