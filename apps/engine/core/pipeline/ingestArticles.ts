// ingestArticles.ts
// Ingest articles from all configured sources and return a flat array
import { RssArticle } from '../ingestion/articleIngestion';
import { fetchArticlesFromRss } from '../ingestion/articleIngestion';
import type { Source } from '@neus/db';
import {
  PipelineStep,
  logPipelineStep,
  logPipelineSection,
  logger,
} from '../../lib/pipelineLogger';

export async function ingestArticles(sources: Source[]): Promise<RssArticle[]> {
  logPipelineStep(PipelineStep.Ingest, 'Ingesting articles from all feeds...');
  let allArticles: RssArticle[] = [];
  for (const source of sources) {
    try {
      const articles = await fetchArticlesFromRss(source.rssFeedUrl);
      allArticles = allArticles.concat(
        articles.map((a) => ({ ...a, sourceId: source.id }))
      );
      logPipelineSection(
        PipelineStep.Ingest,
        `Ingested ${articles.length} articles from ${source.rssFeedUrl}`
      );
    } catch (err: any) {
      logger.warn({ err }, `Failed to ingest from ${source.rssFeedUrl}`);
    }
  }
  logPipelineSection(PipelineStep.Ingest, `Total articles ingested: ${allArticles.length}`);
  return allArticles;
}
