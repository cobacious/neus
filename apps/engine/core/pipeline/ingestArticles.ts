// ingestArticles.ts
// Ingest articles from all feeds in FEED_URLS and return a flat array
import { RssArticle } from '../ingestion/articleIngestion';
import { fetchArticlesFromRss } from '../ingestion/articleIngestion';
import { logPipelineStep, logger } from '../../lib/pipelineLogger';

export async function ingestArticles(feedUrls: string[]): Promise<RssArticle[]> {
  logPipelineStep('Ingesting articles from all feeds...');
  let allArticles: RssArticle[] = [];
  for (const url of feedUrls) {
    try {
      const articles = await fetchArticlesFromRss(url);
      allArticles = allArticles.concat(articles);
      logger.info(`[pipeline] Ingested ${articles.length} articles from ${url}`);
    } catch (err: any) {
      logger.warn({ err }, `[pipeline] Failed to ingest from ${url}`);
    }
  }
  logger.info(`[pipeline] Total articles ingested: ${allArticles.length}`);
  return allArticles;
}
