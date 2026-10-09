// storeArticles.ts
// Store articles in the database only if they don't already exist or have changed
import { syncArticles, isPaywalledSource } from '@neus/db';
import {
  logger,
  logPipelineStep,
  logPipelineSection,
  PipelineStep,
} from '../../lib/pipelineLogger';
import { RssArticle } from '../ingestion/articleIngestion';

export async function storeArticles(articles: RssArticle[]) {
  logPipelineStep(PipelineStep.Store, 'Storing articles in the database...');

  const validArticles = articles
    .filter((article) => {
      if (!article.url || !article.title) {
        logPipelineSection(
          PipelineStep.Store,
          `Skipping article with missing url or title:`,
          article
        );
        return false;
      }
      return true;
    })
    .map((article) => ({
      url: article.url,
      title: article.title,
      source: article.source,
      sourceId: article.sourceId!,
      publishedAt: new Date(article.publishedAt),
      updatedAt: article.updatedAt ? new Date(article.updatedAt) : undefined,
      snippet: article.snippet,
      content: isPaywalledSource(article.source) ? '' : article.content,
      author: article.author,
      categories: article.categories?.join(',') ?? undefined,
    }));

  try {
    const { created, updated, unchanged } = await syncArticles(validArticles);
    logPipelineSection(
      PipelineStep.Store,
      `Article sync complete: ${created} new, ${updated} updated, ${unchanged} unchanged (skipped)`
    );
  } catch (err: any) {
    logger.warn(
      `[${PipelineStep.Store}] Failed to sync articles: ${err.message || err}`,
      err
    );
  }
}
