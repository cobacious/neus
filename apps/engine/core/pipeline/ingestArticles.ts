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

export function cleanArticleTitle(title: string, sourceName: string): string {
  if (!title) return '';
  let clean = title.trim();
  // Strip trailing " - Publication Name" (e.g. "Headline text - The Times")
  clean = clean.replace(
    new RegExp(`\\s*[-–—|]\\s*${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    ''
  );
  // Strip trailing " - Google News"
  clean = clean.replace(/\s*[-–—|]\s*Google News$/i, '');
  return clean.trim();
}

export async function ingestArticles(sources: Source[]): Promise<RssArticle[]> {
  logPipelineStep(PipelineStep.Ingest, 'Ingesting articles from all feeds...');
  let allArticles: RssArticle[] = [];
  for (const source of sources) {
    try {
      const articles = await fetchArticlesFromRss(source.rssFeedUrl);
      allArticles = allArticles.concat(
        articles.map((a) => ({
          ...a,
          source: source.name, // Always attribute to the Source publication name, never Google News
          sourceId: source.id,
          title: cleanArticleTitle(a.title, source.name),
        }))
      );
      logPipelineSection(
        PipelineStep.Ingest,
        `Ingested ${articles.length} articles from ${source.name} (${source.rssFeedUrl})`
      );
    } catch (err: any) {
      logger.warn({ err }, `Failed to ingest from ${source.name} (${source.rssFeedUrl})`);
    }
  }
  logPipelineSection(PipelineStep.Ingest, `Total articles ingested: ${allArticles.length}`);
  return allArticles;
}
