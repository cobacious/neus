// storeArticles.ts
// Store articles in the database, deduplicating by id (url)
import { upsertArticle } from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { RssArticle } from '../ingestion/articleIngestion';

export async function storeArticles(articles: RssArticle[]) {
  logPipelineStep(PipelineStep.Store, 'Storing articles in the database...');
  let stored = 0;
  for (const article of articles) {
    try {
      if (!article.url || !article.title) {
        logPipelineSection(
          PipelineStep.Store,
          `Skipping article with missing url or title:`,
          article
        );
        continue;
      }
      await upsertArticle({
        url: article.url,
        title: article.title,
        source: article.source,
        publishedAt: new Date(article.publishedAt),
        snippet: article.snippet,
        content: article.content,
      });
      logger.debug(`[${PipelineStep.Store}] Upserted article: ${article.title} (${article.url})`);
      stored++;
    } catch (err) {
      logger.warn(
        `[${PipelineStep.Store}] Failed to upsert article: ${article.title} (${article.url})`,
        err
      );
    }
  }
  logPipelineSection(PipelineStep.Store, `Stored/updated ${stored} articles in the database.`);
}
