// storeArticles.ts
// Store articles in the database, deduplicating by id (url)
import { prisma } from '../../lib/prisma';
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
      // Build update/create objects, but do NOT set 'id' in update (cannot update PK)
      const updateData: any = {
        url: article.url,
        title: article.title,
        source: article.source,
        publishedAt: new Date(article.publishedAt),
      };
      const createData: any = {
        url: article.url,
        title: article.title,
        source: article.source,
        publishedAt: new Date(article.publishedAt),
      };
      if (typeof article.snippet !== 'undefined') {
        updateData.snippet = article.snippet;
        createData.snippet = article.snippet;
      }
      if (typeof article.content !== 'undefined') {
        updateData.content = article.content;
        createData.content = article.content;
      }
      await prisma.article.upsert({
        where: {
          url: article.url, // Use url for deduplication
        },
        update: updateData,
        create: createData,
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
