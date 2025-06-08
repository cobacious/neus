// Main processing pipeline for ingested articles
// This is where clustering, summarization, and storage will be handled
import './env'; // Loads .env and proxy support
import { Article } from '../../packages/types/article';
import { fetchArticlesFromRss } from './articleIngestion';
import { FEED_URLS } from './feeds.config';
import { storeArticles } from './storeArticles';
import { fillMissingContent } from './fillMissingContent';
import { embedAndClusterNewArticles } from './embedAndGroup';
import { summarizeClusters } from './summarizeClusters';

export async function runPipeline() {
  // 1. Ingest articles from all feeds
  let allArticles: Article[] = [];
  for (const url of FEED_URLS) {
    try {
      const articles = await fetchArticlesFromRss(url);
      allArticles = allArticles.concat(articles);
      console.log(`[pipeline] Ingested ${articles.length} articles from ${url}`);
    } catch (err: any) {
      console.warn(`[pipeline] Failed to ingest from ${url}:`, err);
    }
  }

  // 2. Store articles in the database
  await storeArticles(allArticles);

  // 3. Fill missing content
  await fillMissingContent();

  // 4. Cluster articles
  await embedAndClusterNewArticles();

  // 5. Summarize clusters
  await summarizeClusters();
}
