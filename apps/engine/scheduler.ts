// Scheduler for periodic article ingestion
// Runs every 4 hours using setInterval (for dev/local); use a real scheduler in production

import { fetchArticlesFromRss } from './articleIngestion';
import { FEED_URLS } from './feeds.config';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

async function ingestAllFeeds() {
  for (const url of FEED_URLS) {
    try {
      const articles = await fetchArticlesFromRss(url);
      // TODO: Store articles in DB or further pipeline
      console.log(`[${new Date().toISOString()}] Ingested ${articles.length} articles from ${url}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error ingesting ${url}:`, err);
    }
  }
}

// Run immediately, then every 4 hours
ingestAllFeeds();
setInterval(ingestAllFeeds, FOUR_HOURS_MS);

// TODO: Replace setInterval with a production scheduler (e.g. cron, serverless cron, or cloud scheduler)
