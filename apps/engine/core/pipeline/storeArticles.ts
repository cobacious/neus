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
  articles.forEach(async (article) => {
    try {
      if (!article.url || !article.title) {
        logPipelineSection(
          PipelineStep.Store,
          `Skipping article with missing url or title:`,
          article
        );
        return;
      }
      await upsertArticle({
        url: article.url,
        title: article.title,
        source: article.source,
        sourceId: article.sourceId!,
        publishedAt: new Date(article.publishedAt),
        updatedAt: article.updatedAt ? new Date(article.updatedAt) : undefined,
        snippet: article.snippet,
        content: article.content,
        author: article.author,
        categories: article.categories?.join(',') ?? undefined,
      });
      logger.debug(`[${PipelineStep.Store}] Upserted article: ${article.title} (${article.url})`);
      stored++;
    } catch (err) {
      logger.warn(
        `[${PipelineStep.Store}] Failed to upsert article: ${article.title} (${article.url})`,
        err
      );
    }
  });
  logPipelineSection(PipelineStep.Store, `Stored/updated ${stored} articles in the database.`);
}
